import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { del } from "@vercel/blob";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  checkIns,
  clanContractClaims,
  clanMemberships,
  clanMessages,
  clans,
  comments,
  goals,
  notificationDeliveries,
  notifications,
  pushSubscriptions,
  reactions,
  users,
} from "@/db/schema";
import { getFoodPhotoUrls, type FoodCheckInValue } from "@/features/check-ins/types";
import { deleteClanData } from "@/features/clans/delete-clan";

/** The earliest-joined member of `clanId` other than `excludeUserId`, or null if there is none. */
async function longestStandingOtherMember(clanId: string, excludeUserId: string) {
  const [member] = await db
    .select({ userId: clanMemberships.userId, role: clanMemberships.role })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.clanId, clanId), ne(clanMemberships.userId, excludeUserId)))
    .orderBy(asc(clanMemberships.joinedAt))
    .limit(1);
  return member ?? null;
}

/**
 * Clans the user runs or created must survive them (or go, if empty): admin passes to the
 * longest-standing member, and `clans.created_by` (NOT NULL, references users) is reassigned so the
 * user row can be deleted. A clan with no one else in it is deleted outright.
 */
async function handOverClans(userId: string) {
  const adminOf = await db
    .select({ clanId: clanMemberships.clanId })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.userId, userId), eq(clanMemberships.role, "admin")));

  for (const { clanId } of adminOf) {
    const successor = await longestStandingOtherMember(clanId, userId);
    if (!successor) {
      await deleteClanData(clanId);
      continue;
    }
    // One admin per clan (clan_memberships_one_admin_idx), so the user's own membership has to go
    // before the successor is promoted.
    await db.delete(clanMemberships).where(and(eq(clanMemberships.clanId, clanId), eq(clanMemberships.userId, userId)));
    await db
      .update(clanMemberships)
      .set({ role: "admin" })
      .where(and(eq(clanMemberships.clanId, clanId), eq(clanMemberships.userId, successor.userId)));
  }

  // Clans they created but no longer run (or just handed over above) still point at them.
  const created = await db.select({ id: clans.id }).from(clans).where(eq(clans.createdBy, userId));
  for (const { id: clanId } of created) {
    const [admin] = await db
      .select({ userId: clanMemberships.userId })
      .from(clanMemberships)
      .where(and(eq(clanMemberships.clanId, clanId), eq(clanMemberships.role, "admin"), ne(clanMemberships.userId, userId)));
    const newOwner = admin ?? (await longestStandingOtherMember(clanId, userId));
    if (newOwner) {
      await db.update(clans).set({ createdBy: newOwner.userId }).where(eq(clans.id, clanId));
    } else {
      await deleteClanData(clanId);
    }
  }
}

/**
 * Permanently deletes a user: their clans are handed over (or deleted if empty), then everything
 * they created or that points at them, then the user row, their uploaded photos, and finally their
 * Clerk account (which signs them out everywhere).
 *
 * No transactions on the Neon HTTP driver, so each step is safe to re-run: if anything fails
 * midway, calling this again picks up where it stopped. Clerk goes last so a failure never leaves
 * someone signed in to an account whose data is half gone without a way to retry.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await handOverClans(userId);

  const ownCheckIns = await db
    .select({ id: checkIns.id, type: checkIns.type, value: checkIns.value })
    .from(checkIns)
    .where(eq(checkIns.userId, userId));
  const checkInIds = ownCheckIns.map((c) => c.id);
  const photoUrls = ownCheckIns.flatMap((c) => (c.type === "food" ? getFoodPhotoUrls(c.value as FoodCheckInValue) : []));

  const ownMessages = await db.select({ id: clanMessages.id }).from(clanMessages).where(eq(clanMessages.userId, userId));
  const messageIds = ownMessages.map((m) => m.id);

  // Their reactions and comments, plus everyone else's on their check-ins and chat messages.
  await db.delete(reactions).where(eq(reactions.userId, userId));
  await db.delete(comments).where(eq(comments.userId, userId));
  if (checkInIds.length > 0) {
    await db.delete(reactions).where(inArray(reactions.checkInId, checkInIds));
    await db.delete(comments).where(inArray(comments.checkInId, checkInIds));
    // Other people's notifications about these check-ins stay, just without the deep link.
    await db.update(notifications).set({ checkInId: null }).where(inArray(notifications.checkInId, checkInIds));
  }
  if (messageIds.length > 0) {
    await db.delete(reactions).where(inArray(reactions.clanMessageId, messageIds));
  }

  await db.delete(notifications).where(eq(notifications.userId, userId));
  await db.delete(notificationDeliveries).where(eq(notificationDeliveries.userId, userId));
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  await db.delete(checkIns).where(eq(checkIns.userId, userId));
  // Replies quoting these messages keep their text; their reply link is set null by the FK.
  await db.delete(clanMessages).where(eq(clanMessages.userId, userId));
  await db.delete(clanContractClaims).where(eq(clanContractClaims.userId, userId));
  await db.delete(goals).where(eq(goals.userId, userId));
  await db.delete(clanMemberships).where(eq(clanMemberships.userId, userId));
  await db.delete(users).where(eq(users.id, userId));

  // Best effort: a failed blob delete leaves an orphaned file behind but must not block the rest.
  if (photoUrls.length > 0) {
    await del(photoUrls).catch((error) => console.error("account deletion: photo cleanup failed", error));
  }

  const clerk = await clerkClient();
  await clerk.users.deleteUser(userId);
}

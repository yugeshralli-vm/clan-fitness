import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clanMemberships, clans, type users } from "@/db/schema";
import { getUsersLoggedToday } from "@/features/check-ins";
import { hasBeenNudgedToday } from "@/features/notifications/queries";
import { notifyUser } from "@/features/notifications/send";
import { getUserById } from "@/lib/current-user";
import { generateInviteCode } from "@/lib/invite-code";
import { deleteClanData } from "./delete-clan";
import { pickNudgeMessage } from "./nudge-messages";
import { getClanById, getClanByInviteCode, getClanMemberCount, getClanMembership } from "./queries";

// The clan mutations behind the web's server actions (./actions.ts) and the Android app's
// /api/v1 routes. They take the already-authenticated user and return `{ error }` instead of
// redirecting or throwing, so each caller decides how to respond.

type Failure = { error: string };
type User = typeof users.$inferSelect;

async function uniqueInviteCode() {
  let inviteCode = generateInviteCode();
  for (let attempts = 0; attempts < 5 && (await getClanByInviteCode(inviteCode)); attempts++) {
    inviteCode = generateInviteCode();
  }
  return inviteCode;
}

function validClanName(raw: string): { name: string } | Failure {
  const name = raw.trim();
  if (!name) return { error: "Clan name is required." };
  if (name.length > 60) return { error: "Clan name is too long." };
  return { name };
}

export async function createClanFor(userId: string, rawName: string, rawDescription: string): Promise<{ clanId: string } | Failure> {
  const valid = validClanName(rawName);
  if ("error" in valid) return valid;
  const description = rawDescription.trim() || null;

  const [clan] = await db
    .insert(clans)
    .values({ name: valid.name, description, inviteCode: await uniqueInviteCode(), createdBy: userId })
    .returning();
  await db.insert(clanMemberships).values({ userId, clanId: clan.id, role: "admin" });
  return { clanId: clan.id };
}

export async function joinClanFor(
  userId: string,
  rawInviteCode: string,
): Promise<{ clanId: string; alreadyMember: boolean } | Failure> {
  const inviteCode = rawInviteCode.trim();
  if (!inviteCode) return { error: "Invite code is required." };

  const clan = await getClanByInviteCode(inviteCode);
  if (!clan) return { error: "Invalid invite code." };

  if (await getClanMembership(userId, clan.id)) return { clanId: clan.id, alreadyMember: true };

  const memberCount = await getClanMemberCount(clan.id);
  if (memberCount >= clan.maxSize) return { error: "This clan is full." };

  await db.insert(clanMemberships).values({ userId, clanId: clan.id, role: "member" });
  return { clanId: clan.id, alreadyMember: false };
}

export async function leaveClanFor(userId: string, clanId: string): Promise<{ left: true } | Failure> {
  const membership = await getClanMembership(userId, clanId);
  if (!membership) return { error: "You're not a member of this clan." };
  if (membership.role === "admin") {
    return { error: "Admins can't leave a clan — make someone else admin first." };
  }

  await db.delete(clanMemberships).where(and(eq(clanMemberships.userId, userId), eq(clanMemberships.clanId, clanId)));
  return { left: true };
}

export async function renameClanFor(userId: string, clanId: string, rawName: string): Promise<{ name: string } | Failure> {
  const membership = await getClanMembership(userId, clanId);
  if (!membership || membership.role !== "admin") return { error: "Only clan admins can rename the clan." };

  const valid = validClanName(rawName);
  if ("error" in valid) return valid;

  await db.update(clans).set({ name: valid.name }).where(eq(clans.id, clanId));
  return valid;
}

export async function deleteClanFor(userId: string, clanId: string, rawConfirmName: string): Promise<{ deleted: true } | Failure> {
  const membership = await getClanMembership(userId, clanId);
  if (!membership || membership.role !== "admin") return { error: "Only the clan admin can delete the clan." };

  const clan = await getClanById(clanId);
  if (!clan) return { error: "Clan not found." };
  if (rawConfirmName.trim() !== clan.name) return { error: "Type the clan name exactly to confirm." };

  // Shared with account deletion — also removes chat messages and contract claims, which this
  // used to miss (their foreign keys made deleting any clan with chat history fail).
  await deleteClanData(clanId);
  return { deleted: true };
}

export async function removeMemberFor(userId: string, clanId: string, memberUserId: string): Promise<{ removed: true } | Failure> {
  const membership = await getClanMembership(userId, clanId);
  if (!membership || membership.role !== "admin") return { error: "Only clan admins can remove members." };
  if (memberUserId === userId) return { error: "Use 'Leave clan' to remove yourself." };

  const target = await getClanMembership(memberUserId, clanId);
  if (!target) return { error: "That user is not a member of this clan." };

  await db
    .delete(clanMemberships)
    .where(and(eq(clanMemberships.userId, memberUserId), eq(clanMemberships.clanId, clanId)));
  return { removed: true };
}

export async function makeAdminFor(userId: string, clanId: string, targetUserId: string): Promise<{ transferred: true } | Failure> {
  const membership = await getClanMembership(userId, clanId);
  if (!membership || membership.role !== "admin") return { error: "Only the clan admin can transfer admin." };
  if (targetUserId === userId) return { error: "You're already the admin." };

  const target = await getClanMembership(targetUserId, clanId);
  if (!target) return { error: "That user is not a member of this clan." };

  // Two sequential updates, not a transaction (the Neon HTTP driver doesn't support them) — demote
  // first so the "one admin per clan" partial unique index never sees two admin rows at once. A
  // combined single-statement CASE update was tried and confirmed unsafe: Postgres checks the
  // partial unique index per-row as it processes an UPDATE, not once at the end, so whichever row
  // happens to be processed first determines whether it spuriously conflicts with the other row's
  // not-yet-updated value. Worst case if this fails between the two steps is zero admins, not a
  // constraint violation or two admins — a safe, recoverable failure mode.
  await db.update(clanMemberships).set({ role: "member" }).where(eq(clanMemberships.id, membership.id));
  await db.update(clanMemberships).set({ role: "admin" }).where(eq(clanMemberships.id, target.id));
  return { transferred: true };
}

export async function regenerateInviteCodeFor(userId: string, clanId: string): Promise<{ inviteCode: string } | Failure> {
  const membership = await getClanMembership(userId, clanId);
  if (!membership || membership.role !== "admin") return { error: "Only clan admins can regenerate the invite code." };

  const inviteCode = await uniqueInviteCode();
  await db.update(clans).set({ inviteCode }).where(eq(clans.id, clanId));
  return { inviteCode };
}

export async function nudgeMemberFor(user: User, clanId: string, targetUserId: string): Promise<{ sent: true } | Failure> {
  if (targetUserId === user.id) return { error: "You can't nudge yourself." };

  const membership = await getClanMembership(user.id, clanId);
  if (!membership) return { error: "You're not a member of this clan." };
  const target = await getClanMembership(targetUserId, clanId);
  if (!target) return { error: "That user is not a member of this clan." };

  const loggedToday = await getUsersLoggedToday([user.id, targetUserId], user.timezone);
  if (!loggedToday.has(user.id)) return { error: "Log today before nudging someone else." };
  if (loggedToday.has(targetUserId)) return { error: "They've already logged today." };

  // The recipient's own day, not the sender's — see hasBeenNudgedToday.
  const targetUser = await getUserById(targetUserId);
  if (await hasBeenNudgedToday(targetUserId, targetUser?.timezone ?? null)) {
    return { error: "Already nudged today." };
  }

  await notifyUser(targetUserId, {
    type: "nudge",
    title: pickNudgeMessage(),
    body: `${user.name} nudged you to log today.`,
    url: "/logs",
  });
  return { sent: true };
}

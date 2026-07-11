"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { clanMemberships, clans, comments, reactions } from "@/db/schema";
import { getUsersLoggedToday } from "@/features/check-ins";
import { hasBeenNudgedToday } from "@/features/notifications/queries";
import { notifyUser } from "@/features/notifications/send";
import { getOrSyncCurrentUser } from "@/lib/current-user";
import { generateInviteCode } from "@/lib/invite-code";
import { pickNudgeMessage } from "./nudge-messages";
import { getClanById, getClanByInviteCode, getClanMemberCount, getClanMembership } from "./queries";

export type ClanActionState = { error?: string } | undefined;

export async function createClan(
  _prevState: ClanActionState,
  formData: FormData,
): Promise<ClanActionState> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Clan name is required." };
  if (name.length > 60) return { error: "Clan name is too long." };
  const description = String(formData.get("description") ?? "").trim() || null;

  let inviteCode = generateInviteCode();
  for (let attempts = 0; attempts < 5 && (await getClanByInviteCode(inviteCode)); attempts++) {
    inviteCode = generateInviteCode();
  }

  const [clan] = await db
    .insert(clans)
    .values({ name, description, inviteCode, createdBy: user.id })
    .returning();

  await db.insert(clanMemberships).values({ userId: user.id, clanId: clan.id, role: "admin" });

  revalidatePath("/logs");
  redirect(`/clans/${clan.id}/welcome`);
}

export async function joinClanByInviteCode(
  _prevState: ClanActionState,
  formData: FormData,
): Promise<ClanActionState> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  const inviteCode = String(formData.get("inviteCode") ?? "").trim();
  if (!inviteCode) return { error: "Invite code is required." };

  const clan = await getClanByInviteCode(inviteCode);
  if (!clan) return { error: "Invalid invite code." };

  const existingMembership = await getClanMembership(user.id, clan.id);
  if (existingMembership) redirect(`/clans/${clan.id}`);

  const memberCount = await getClanMemberCount(clan.id);
  if (memberCount >= clan.maxSize) return { error: "This clan is full." };

  await db.insert(clanMemberships).values({ userId: user.id, clanId: clan.id, role: "member" });

  revalidatePath("/logs");
  redirect(`/clans/${clan.id}/welcome`);
}

export async function leaveClan(clanId: string) {
  const user = await getOrSyncCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const membership = await getClanMembership(user.id, clanId);
  if (!membership) throw new Error("You're not a member of this clan.");
  if (membership.role === "admin") {
    throw new Error("Admins can't leave a clan — make someone else admin first.");
  }

  await db
    .delete(clanMemberships)
    .where(and(eq(clanMemberships.userId, user.id), eq(clanMemberships.clanId, clanId)));

  revalidatePath("/logs");
  redirect("/logs");
}

export async function renameClan(
  clanId: string,
  _prevState: ClanActionState,
  formData: FormData,
): Promise<ClanActionState> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  const membership = await getClanMembership(user.id, clanId);
  if (!membership || membership.role !== "admin") {
    return { error: "Only clan admins can rename the clan." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Clan name is required." };
  if (name.length > 60) return { error: "Clan name is too long." };

  await db.update(clans).set({ name }).where(eq(clans.id, clanId));

  revalidatePath(`/clans/${clanId}`);
  revalidatePath(`/clans/${clanId}/manage`);
}

export async function deleteClan(
  clanId: string,
  _prevState: ClanActionState,
  formData: FormData,
): Promise<ClanActionState> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  const membership = await getClanMembership(user.id, clanId);
  if (!membership || membership.role !== "admin") {
    return { error: "Only the clan admin can delete the clan." };
  }

  const clan = await getClanById(clanId);
  if (!clan) return { error: "Clan not found." };

  const confirmName = String(formData.get("confirmName") ?? "").trim();
  if (confirmName !== clan.name) {
    return { error: "Type the clan name exactly to confirm." };
  }

  // No transaction (the Neon HTTP driver doesn't support them, same as makeAdmin below) — delete
  // children before the parent row, since none of these FKs cascade. checkIns are untouched:
  // they're personal records with no clanId of their own (see schema.ts), so members keep their
  // own log history — only this clan's shared reactions/comments/membership rows go away.
  await db.delete(reactions).where(eq(reactions.clanId, clanId));
  await db.delete(comments).where(eq(comments.clanId, clanId));
  await db.delete(clanMemberships).where(eq(clanMemberships.clanId, clanId));
  await db.delete(clans).where(eq(clans.id, clanId));

  revalidatePath("/logs");
  redirect("/logs");
}

export async function removeMember(clanId: string, memberUserId: string) {
  const user = await getOrSyncCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const membership = await getClanMembership(user.id, clanId);
  if (!membership || membership.role !== "admin") {
    throw new Error("Only clan admins can remove members.");
  }
  if (memberUserId === user.id) {
    throw new Error("Use 'Leave clan' to remove yourself.");
  }

  const target = await getClanMembership(memberUserId, clanId);
  if (!target) throw new Error("That user is not a member of this clan.");

  await db
    .delete(clanMemberships)
    .where(and(eq(clanMemberships.userId, memberUserId), eq(clanMemberships.clanId, clanId)));

  revalidatePath(`/clans/${clanId}/manage`);
}

export async function makeAdmin(clanId: string, targetUserId: string) {
  const user = await getOrSyncCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const membership = await getClanMembership(user.id, clanId);
  if (!membership || membership.role !== "admin") {
    throw new Error("Only the clan admin can transfer admin.");
  }
  if (targetUserId === user.id) throw new Error("You're already the admin.");

  const target = await getClanMembership(targetUserId, clanId);
  if (!target) throw new Error("That user is not a member of this clan.");

  // Two sequential updates, not a transaction (the Neon HTTP driver doesn't support them) — demote
  // first so the "one admin per clan" partial unique index never sees two admin rows at once. A
  // combined single-statement CASE update was tried and confirmed unsafe: Postgres checks the
  // partial unique index per-row as it processes an UPDATE, not once at the end, so whichever row
  // happens to be processed first determines whether it spuriously conflicts with the other row's
  // not-yet-updated value. Worst case if this fails between the two steps is zero admins, not a
  // constraint violation or two admins — a safe, recoverable failure mode.
  await db.update(clanMemberships).set({ role: "member" }).where(eq(clanMemberships.id, membership.id));
  await db.update(clanMemberships).set({ role: "admin" }).where(eq(clanMemberships.id, target.id));

  revalidatePath(`/clans/${clanId}/manage`);
}

export async function regenerateInviteCode(clanId: string) {
  const user = await getOrSyncCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const membership = await getClanMembership(user.id, clanId);
  if (!membership || membership.role !== "admin") {
    throw new Error("Only clan admins can regenerate the invite code.");
  }

  let inviteCode = generateInviteCode();
  for (let attempts = 0; attempts < 5 && (await getClanByInviteCode(inviteCode)); attempts++) {
    inviteCode = generateInviteCode();
  }

  await db.update(clans).set({ inviteCode }).where(eq(clans.id, clanId));

  revalidatePath(`/clans/${clanId}/manage`);
}

export type NudgeActionState = { error?: string; sent?: boolean } | undefined;

export async function nudgeMember(clanId: string, targetUserId: string): Promise<NudgeActionState> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };
  if (targetUserId === user.id) return { error: "You can't nudge yourself." };

  const membership = await getClanMembership(user.id, clanId);
  if (!membership) return { error: "You're not a member of this clan." };
  const target = await getClanMembership(targetUserId, clanId);
  if (!target) return { error: "That user is not a member of this clan." };

  const loggedToday = await getUsersLoggedToday([user.id, targetUserId]);
  if (!loggedToday.has(user.id)) return { error: "Log today before nudging someone else." };
  if (loggedToday.has(targetUserId)) return { error: "They've already logged today." };

  if (await hasBeenNudgedToday(targetUserId)) return { error: "Already nudged today." };

  await notifyUser(targetUserId, {
    type: "nudge",
    title: pickNudgeMessage(),
    body: `${user.name} nudged you to log today.`,
    url: "/logs",
  });

  return { sent: true };
}

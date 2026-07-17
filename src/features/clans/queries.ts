import "server-only";

import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { clanMemberships, clans, users } from "@/db/schema";

export async function getUserClans(userId: string) {
  return db
    .select({ clan: clans, role: clanMemberships.role })
    .from(clanMemberships)
    .innerJoin(clans, eq(clanMemberships.clanId, clans.id))
    .where(eq(clanMemberships.userId, userId));
}

/** Same as getUserClans, but only clans joined by `asOf` — "which clans could a check-in from this moment be visible in." */
export async function getUserClansAsOf(userId: string, asOf: Date) {
  return db
    .select({ clan: clans, role: clanMemberships.role })
    .from(clanMemberships)
    .innerJoin(clans, eq(clanMemberships.clanId, clans.id))
    .where(and(eq(clanMemberships.userId, userId), lte(clanMemberships.joinedAt, asOf)));
}

/** Clans two users are both currently in — the authorization check for viewing someone's profile
 * (same "clan-mates only" visibility rule as the feed/leaderboard/comments), and also useful for
 * showing which clan(s) a viewed profile is shared in. Clan counts per user are tiny, so
 * intersecting in application code is simpler than a self-join and costs nothing meaningful. */
export async function getSharedClans(userIdA: string, userIdB: string) {
  const [clansA, clansB] = await Promise.all([getUserClans(userIdA), getUserClans(userIdB)]);
  const idsB = new Set(clansB.map((c) => c.clan.id));
  return clansA.map((c) => c.clan).filter((clan) => idsB.has(clan.id));
}

export async function getClanById(clanId: string) {
  const [clan] = await db.select().from(clans).where(eq(clans.id, clanId));
  return clan ?? null;
}

export async function getClanByInviteCode(inviteCode: string) {
  const [clan] = await db.select().from(clans).where(eq(clans.inviteCode, inviteCode));
  return clan ?? null;
}

export async function getClanMembership(userId: string, clanId: string) {
  const [membership] = await db
    .select()
    .from(clanMemberships)
    .where(and(eq(clanMemberships.userId, userId), eq(clanMemberships.clanId, clanId)));
  return membership ?? null;
}

export async function getClanMembers(clanId: string) {
  return db
    .select({ user: users, role: clanMemberships.role, joinedAt: clanMemberships.joinedAt })
    .from(clanMemberships)
    .innerJoin(users, eq(clanMemberships.userId, users.id))
    .where(eq(clanMemberships.clanId, clanId));
}

export async function getClanMembersForClanIds(clanIds: string[]) {
  if (clanIds.length === 0) return [];

  return db
    .select({ user: users, role: clanMemberships.role, joinedAt: clanMemberships.joinedAt })
    .from(clanMemberships)
    .innerJoin(users, eq(clanMemberships.userId, users.id))
    .where(inArray(clanMemberships.clanId, clanIds));
}

export async function getClanMemberCount(clanId: string) {
  const members = await db
    .select({ userId: clanMemberships.userId })
    .from(clanMemberships)
    .where(eq(clanMemberships.clanId, clanId));
  return members.length;
}

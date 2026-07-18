"use server";

import { auth } from "@clerk/nextjs/server";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { clanContractClaims } from "@/db/schema";
import { getAppConfig } from "@/features/admin/config";
import { getClanMembers, getClanMembership } from "@/features/clans/queries";
import { userDayKey } from "@/lib/timezone-date";
import { getContract, WAGER_STAKE } from "./catalog";
import { getContractBoard } from "./queries";
import type { ContractBoardEntry } from "./types";

const CLAN_TIMEZONE = "Asia/Kolkata";

async function resolveAccess(clanId: string) {
  const { userId } = await auth();
  if (!userId) return { allowed: false as const };
  const membership = await getClanMembership(userId, clanId);
  if (!membership) return { allowed: false as const };
  return { allowed: true as const, userId };
}

/** Picks a random clanmate (not the claimant) who hasn't already been assigned as a duel opponent
 * today, across either duel contract — falls back to allowing a repeat if the clan is too small
 * to give everyone a fresh rival. */
async function assignDuelOpponent(clanId: string, userId: string, dayKey: string): Promise<string | null> {
  const [members, todaysClaims] = await Promise.all([
    getClanMembers(clanId),
    db
      .select({ meta: clanContractClaims.meta })
      .from(clanContractClaims)
      .where(and(eq(clanContractClaims.clanId, clanId), eq(clanContractClaims.dayKey, dayKey), isNotNull(clanContractClaims.meta))),
  ]);

  const usedOpponents = new Set(
    todaysClaims.map((claim) => (claim.meta as Record<string, unknown> | null)?.opponentUserId as string | undefined).filter(Boolean),
  );

  const candidates = members.map((m) => m.user.id).filter((id) => id !== userId);
  const fresh = candidates.filter((id) => !usedOpponents.has(id));
  const pool = fresh.length > 0 ? fresh : candidates;
  if (pool.length === 0) return null;

  return pool[Math.floor(Math.random() * pool.length)];
}

export type ClaimContractResult = { board: ContractBoardEntry[] } | { error: string };

export async function claimContract(clanId: string, contractId: string): Promise<ClaimContractResult> {
  const access = await resolveAccess(clanId);
  if (!access.allowed) return { error: "Not authorized." };

  const contract = getContract(contractId);
  if (!contract) return { error: "Unknown contract." };

  const dayKey = userDayKey(CLAN_TIMEZONE, new Date());
  const config = await getAppConfig();

  const [{ count: claimedToday }] = await db
    .select({ count: count() })
    .from(clanContractClaims)
    .where(and(eq(clanContractClaims.clanId, clanId), eq(clanContractClaims.userId, access.userId), eq(clanContractClaims.dayKey, dayKey)));
  if (claimedToday >= config.maxClaimsPerMemberPerDay) {
    return { error: `You've already claimed your ${config.maxClaimsPerMemberPerDay} contract(s) today.` };
  }

  let meta: Record<string, unknown> | null = null;
  if (contract.needsOpponent) {
    const opponentUserId = await assignDuelOpponent(clanId, access.userId, dayKey);
    if (!opponentUserId) return { error: "No clanmate available to duel today." };
    meta = { opponentUserId };
  } else if (contract.isWager) {
    meta = { stake: WAGER_STAKE };
  }

  const inserted = await db
    .insert(clanContractClaims)
    .values({ clanId, userId: access.userId, contractId, dayKey, meta })
    .onConflictDoNothing({ target: [clanContractClaims.clanId, clanContractClaims.contractId, clanContractClaims.dayKey] })
    .returning({ id: clanContractClaims.id });

  if (inserted.length === 0) {
    return { error: "Someone just claimed this contract." };
  }

  revalidatePath(`/clans/${clanId}/contracts`);
  return { board: await getContractBoard(clanId, dayKey) };
}

/** Called from the client to refresh the board (e.g. after a failed claim, or on a poll). */
export async function fetchContractBoard(clanId: string): Promise<ContractBoardEntry[]> {
  const access = await resolveAccess(clanId);
  if (!access.allowed) return [];
  return getContractBoard(clanId, userDayKey(CLAN_TIMEZONE, new Date()));
}

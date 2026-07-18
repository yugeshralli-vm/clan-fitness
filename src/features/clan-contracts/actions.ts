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
import { kolkataDayStart } from "./resolve";
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

export type ClaimContractResult =
  | { board: ContractBoardEntry[]; justCompleted?: { title: string; points: number } }
  | { error: string };

/** Live, read-only "would this be satisfied right now" check — never writes status/pointsAwarded.
 * Final completion is only ever written by the next day's resolution cron (see resolve.ts),
 * since check-ins are editable same-day and this could still flip before then. */
async function checkLiveCompletion(
  clanId: string,
  userId: string,
  contractId: string,
  dayKey: string,
  meta: Record<string, unknown> | null,
) {
  const contract = getContract(contractId);
  if (!contract) return false;
  const dayStart = kolkataDayStart(dayKey);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const { completed } = await contract.evaluate({ userId, clanId, dayStart, dayEnd, meta });
  return completed;
}

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

  // A simpler contract (e.g. "log any check-in") can already be satisfied the instant it's
  // claimed — this is purely a celebratory preview for the client, see checkLiveCompletion.
  const board = await getContractBoard(clanId, dayKey);
  const completed = await checkLiveCompletion(clanId, access.userId, contractId, dayKey, meta);
  const justCompleted = completed ? { title: contract.title, points: contract.points } : undefined;

  return { board, justCompleted };
}

/** For the client to poll: re-checks every one of the caller's own still-"claimed" (unresolved)
 * contracts today against the live data, so a contract satisfied *after* being claimed (e.g. you
 * claim "comment on a check-in" and then go comment) can still surface a completion toast before
 * the next day's cron formally resolves it — not just contracts already true at claim time. */
export async function getMyLiveClaimProgress(
  clanId: string,
): Promise<{ contractId: string; title: string; points: number; completed: boolean }[]> {
  const access = await resolveAccess(clanId);
  if (!access.allowed) return [];

  const dayKey = userDayKey(CLAN_TIMEZONE, new Date());
  const myClaims = await db
    .select()
    .from(clanContractClaims)
    .where(
      and(
        eq(clanContractClaims.clanId, clanId),
        eq(clanContractClaims.userId, access.userId),
        eq(clanContractClaims.dayKey, dayKey),
        eq(clanContractClaims.status, "claimed"),
      ),
    );

  return Promise.all(
    myClaims.map(async (claim) => {
      const contract = getContract(claim.contractId);
      const completed = await checkLiveCompletion(
        clanId,
        access.userId,
        claim.contractId,
        dayKey,
        claim.meta as Record<string, unknown> | null,
      );
      return { contractId: claim.contractId, title: contract?.title ?? claim.contractId, points: contract?.points ?? 0, completed };
    }),
  );
}

/** Called from the client to refresh the board (e.g. after a failed claim, or on a poll). */
export async function fetchContractBoard(clanId: string): Promise<ContractBoardEntry[]> {
  const access = await resolveAccess(clanId);
  if (!access.allowed) return [];
  return getContractBoard(clanId, userDayKey(CLAN_TIMEZONE, new Date()));
}

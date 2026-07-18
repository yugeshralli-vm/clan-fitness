import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clanContractClaims, users } from "@/db/schema";
import { getContract } from "./catalog";

// Asia/Kolkata never observes DST (fixed +05:30 year-round), so a dayKey's local midnight can be
// reconstructed directly from an explicit-offset ISO string — no need for the Intl-based
// DST-safe machinery src/lib/timezone-date.ts uses for per-user timezones.
function kolkataDayStart(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00+05:30`);
}

export type ResolveClanContractsResult = {
  clanId: string;
  dayKey: string;
  resolved: number;
  totalPointsAwarded: number;
};

/** Finalizes yesterday's (just-ended) contract claims for one clan: evaluates each unresolved
 * claim's catalog rule against final data, sets status/pointsAwarded, and adds the result to the
 * claimant's permanent users.totalPoints. Idempotent — a claim only resolves once (status moves
 * out of "claimed"), so a retried/duplicate cron run is safe. */
export async function resolveContractsForClan(clanId: string, dayKey: string): Promise<ResolveClanContractsResult> {
  const dayStart = kolkataDayStart(dayKey);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const claims = await db
    .select()
    .from(clanContractClaims)
    .where(
      and(eq(clanContractClaims.clanId, clanId), eq(clanContractClaims.dayKey, dayKey), eq(clanContractClaims.status, "claimed")),
    );

  let totalPointsAwarded = 0;

  for (const claim of claims) {
    const contract = getContract(claim.contractId);
    if (!contract) continue; // catalog entry removed/renamed since claimed — leave it, nothing to resolve against

    const { completed, pointsAwarded } = await contract.evaluate({
      userId: claim.userId,
      clanId,
      dayStart,
      dayEnd,
      meta: claim.meta as Record<string, unknown> | null,
    });

    await db
      .update(clanContractClaims)
      .set({ status: completed ? "completed" : "failed", pointsAwarded, resolvedAt: new Date() })
      .where(eq(clanContractClaims.id, claim.id));

    if (pointsAwarded !== 0) {
      await db
        .update(users)
        .set({ totalPoints: sql`${users.totalPoints} + ${pointsAwarded}` })
        .where(eq(users.id, claim.userId));
      totalPointsAwarded += pointsAwarded;
    }
  }

  return { clanId, dayKey, resolved: claims.length, totalPointsAwarded };
}

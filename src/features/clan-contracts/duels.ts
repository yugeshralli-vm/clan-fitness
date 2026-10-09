import "server-only";

import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { clanContractClaims } from "@/db/schema";
import { notifyUser } from "@/features/notifications/send";
import { userDayKey } from "@/lib/timezone-date";
import { CONTRACT_CATALOG, getContract } from "./catalog";
import { getStepsInWindow } from "./eval-helpers";
import { kolkataDayStart } from "./resolve";

const DUEL_CONTRACT_IDS = CONTRACT_CATALOG.filter((c) => c.needsOpponent).map((c) => c.id);

export type DuelStanding = {
  claimId: string;
  clanId: string;
  contractId: string;
  claimantId: string;
  opponentId: string;
  claimantSteps: number;
  opponentSteps: number;
};

function todayWindow() {
  const dayKey = userDayKey("Asia/Kolkata", new Date());
  const dayStart = kolkataDayStart(dayKey);
  return { dayKey, dayStart, dayEnd: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) };
}

/** Today's still-open duels this user is in, on either side, with both step totals right now. */
export async function getDuelStandings(userId: string): Promise<DuelStanding[]> {
  const { dayKey, dayStart, dayEnd } = todayWindow();
  const claims = await db
    .select()
    .from(clanContractClaims)
    .where(
      and(
        eq(clanContractClaims.dayKey, dayKey),
        eq(clanContractClaims.status, "claimed"),
        inArray(clanContractClaims.contractId, DUEL_CONTRACT_IDS),
        or(eq(clanContractClaims.userId, userId), sql`${clanContractClaims.meta}->>'opponentUserId' = ${userId}`),
      ),
    );

  return Promise.all(
    claims.flatMap((claim) => {
      const opponentId = (claim.meta as Record<string, unknown> | null)?.opponentUserId;
      if (typeof opponentId !== "string") return [];
      return [
        Promise.all([getStepsInWindow(claim.userId, dayStart, dayEnd), getStepsInWindow(opponentId, dayStart, dayEnd)]).then(
          ([claimantSteps, opponentSteps]) => ({
            claimId: claim.id,
            clanId: claim.clanId,
            contractId: claim.contractId,
            claimantId: claim.userId,
            opponentId,
            claimantSteps,
            opponentSteps,
          }),
        ),
      ];
    }),
  );
}

function leader(standing: DuelStanding): string | null {
  if (standing.claimantSteps === standing.opponentSteps) return null;
  return standing.claimantSteps > standing.opponentSteps ? standing.claimantId : standing.opponentId;
}

/**
 * Compares `before` (taken just before this user logged steps) with standings now, and pushes a
 * "you've been overtaken" notification to the other side of every duel this user just took the
 * lead in. Only lead changes notify — logging more steps while already ahead stays quiet.
 */
export async function notifyDuelOvertakes(actor: { id: string; name: string }, before: DuelStanding[]) {
  if (before.length === 0) return;
  const beforeById = new Map(before.map((s) => [s.claimId, s]));
  const after = await getDuelStandings(actor.id);

  await Promise.all(
    after.map((now) => {
      const was = beforeById.get(now.claimId);
      if (!was || leader(was) === actor.id || leader(now) !== actor.id) return;
      const rivalId = now.claimantId === actor.id ? now.opponentId : now.claimantId;
      const [actorSteps, rivalSteps] =
        now.claimantId === actor.id ? [now.claimantSteps, now.opponentSteps] : [now.opponentSteps, now.claimantSteps];
      const title = getContract(now.contractId)?.title ?? "Duel";
      return notifyUser(rivalId, {
        type: "contract",
        title: `⚔️ ${actor.name} just overtook you`,
        body: `${title}: ${actorSteps.toLocaleString("en-IN")} vs your ${rivalSteps.toLocaleString("en-IN")} steps. Time to move.`,
        url: `/clans/${now.clanId}/contracts`,
      });
    }),
  );
}

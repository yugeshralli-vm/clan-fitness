import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clanContractClaims } from "@/db/schema";
import { publishClanEvent } from "@/lib/realtime";
import { userDayKey } from "@/lib/timezone-date";
import { getContract } from "./catalog";
import { kolkataDayStart } from "./resolve";
import type { ContractMoment } from "./types";

export function publishContractMoment(clanId: string, moment: ContractMoment) {
  return publishClanEvent(clanId, "contract_moment", moment.userId, moment);
}

/**
 * Announces, once each, any of this user's open claims today that their latest action just
 * satisfied — called after anything that can complete a contract (check-in, comment, reaction,
 * chat message, claim). Completion is otherwise only ever computed on read, so without this the
 * clan would only see it by having the board open.
 *
 * Marked in the claim's meta with a conditional update, so concurrent calls can't announce twice.
 * It's a preview like the board's checkmark: the nightly cron still decides the actual outcome.
 */
export async function announceContractCompletions(actor: { id: string; name: string }) {
  const dayKey = userDayKey("Asia/Kolkata", new Date());
  const dayStart = kolkataDayStart(dayKey);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const claims = await db
    .select()
    .from(clanContractClaims)
    .where(
      and(
        eq(clanContractClaims.userId, actor.id),
        eq(clanContractClaims.dayKey, dayKey),
        eq(clanContractClaims.status, "claimed"),
        sql`not (coalesce(${clanContractClaims.meta}, '{}'::jsonb) ? 'completionAnnounced')`,
      ),
    );

  await Promise.all(
    claims.map(async (claim) => {
      const contract = getContract(claim.contractId);
      if (!contract) return;
      const meta = claim.meta as Record<string, unknown> | null;
      const { completed } = await contract.evaluate({ userId: actor.id, clanId: claim.clanId, dayStart, dayEnd, meta });
      if (!completed) return;

      const marked = await db
        .update(clanContractClaims)
        .set({ meta: sql`coalesce(${clanContractClaims.meta}, '{}'::jsonb) || '{"completionAnnounced": true}'::jsonb` })
        .where(
          and(
            eq(clanContractClaims.id, claim.id),
            sql`not (coalesce(${clanContractClaims.meta}, '{}'::jsonb) ? 'completionAnnounced')`,
          ),
        )
        .returning({ id: clanContractClaims.id });
      if (marked.length === 0) return;

      await publishContractMoment(claim.clanId, {
        kind: "completed",
        contractTitle: contract.title,
        userId: actor.id,
        userName: actor.name,
        points: contract.points,
      });
    }),
  );
}

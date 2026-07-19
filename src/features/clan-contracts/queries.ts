import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clanContractClaims, users } from "@/db/schema";
import { CONTRACT_CATALOG } from "./catalog";
import { kolkataDayStart } from "./resolve";
import type { ContractBoardEntry } from "./types";

/** `viewerUserId` is whoever is loading the board, not the claimant — a target like "beat your
 * average" depends on the viewer's own history and must be knowable before they've claimed
 * anything, so it's computed per-viewer rather than per-claim. */
export async function getContractBoard(clanId: string, dayKey: string, viewerUserId: string): Promise<ContractBoardEntry[]> {
  const claims = await db
    .select({
      contractId: clanContractClaims.contractId,
      status: clanContractClaims.status,
      userId: clanContractClaims.userId,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
      meta: clanContractClaims.meta,
    })
    .from(clanContractClaims)
    .innerJoin(users, eq(clanContractClaims.userId, users.id))
    .where(and(eq(clanContractClaims.clanId, clanId), eq(clanContractClaims.dayKey, dayKey)));

  // Duel contracts stash their opponent's id in meta — resolve names for display in one extra
  // query rather than joining users twice above (opponent count per day is at most a handful).
  const opponentIds = [
    ...new Set(
      claims
        .map((claim) => (claim.meta as Record<string, unknown> | null)?.opponentUserId as string | undefined)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const opponents =
    opponentIds.length > 0 ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, opponentIds)) : [];
  const opponentNameById = new Map(opponents.map((opponent) => [opponent.id, opponent.name]));

  const claimByContractId = new Map(claims.map((claim) => [claim.contractId, claim]));
  const dayStart = kolkataDayStart(dayKey);

  return Promise.all(
    CONTRACT_CATALOG.map(async (contract) => {
      const claim = claimByContractId.get(contract.id);
      const opponentId = (claim?.meta as Record<string, unknown> | null)?.opponentUserId as string | undefined;
      const targetSteps = contract.getTarget ? ((await contract.getTarget({ userId: viewerUserId, dayStart })) ?? undefined) : undefined;
      return {
        contract: { id: contract.id, tier: contract.tier, title: contract.title, description: contract.description, points: contract.points },
        claim: claim
          ? {
              userId: claim.userId,
              userName: claim.userName,
              userAvatarUrl: claim.userAvatarUrl,
              status: claim.status,
              opponentName: opponentId ? opponentNameById.get(opponentId) : undefined,
            }
          : null,
        targetSteps,
      };
    }),
  );
}

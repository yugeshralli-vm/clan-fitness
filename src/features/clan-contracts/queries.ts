import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clanContractClaims, users } from "@/db/schema";
import { CONTRACT_CATALOG } from "./catalog";
import type { ContractBoardEntry } from "./types";

export async function getContractBoard(clanId: string, dayKey: string): Promise<ContractBoardEntry[]> {
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

  return CONTRACT_CATALOG.map((contract) => {
    const claim = claimByContractId.get(contract.id);
    const opponentId = (claim?.meta as Record<string, unknown> | null)?.opponentUserId as string | undefined;
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
    };
  });
}

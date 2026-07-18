import "server-only";

import { and, eq } from "drizzle-orm";
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
    })
    .from(clanContractClaims)
    .innerJoin(users, eq(clanContractClaims.userId, users.id))
    .where(and(eq(clanContractClaims.clanId, clanId), eq(clanContractClaims.dayKey, dayKey)));

  const claimByContractId = new Map(claims.map((claim) => [claim.contractId, claim]));

  return CONTRACT_CATALOG.map((contract) => {
    const claim = claimByContractId.get(contract.id);
    return {
      contract: { id: contract.id, tier: contract.tier, title: contract.title, description: contract.description, points: contract.points },
      claim: claim ? { userId: claim.userId, userName: claim.userName, userAvatarUrl: claim.userAvatarUrl, status: claim.status } : null,
    };
  });
}

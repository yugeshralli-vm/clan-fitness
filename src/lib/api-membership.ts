import "server-only";

import { getClanMembership } from "@/features/clans/queries";
import { apiError } from "./api-response";

/** 403 unless `userId` is a member of `clanId` — the gate every clan-scoped /api/v1 route needs. */
export async function requireClanMember(userId: string, clanId: string | null | undefined) {
  if (!clanId) return { error: apiError(400, "clanId is required.") } as const;
  const membership = await getClanMembership(userId, clanId);
  if (!membership) return { error: apiError(403, "Not a member of this clan.") } as const;
  return { membership } as const;
}

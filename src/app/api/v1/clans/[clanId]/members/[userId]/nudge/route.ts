import { NextResponse } from "next/server";
import { nudgeMemberFor } from "@/features/clans/mutations";
import { apiError, requireApiUser } from "@/lib/api-response";

/**
 * POST /api/v1/clans/:clanId/members/:userId/nudge — nudge a clanmate who hasn't logged today. Same
 * rules as the web: you must have logged today, and each person gets at most one nudge per day.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ clanId: string; userId: string }> }) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const { clanId, userId } = await params;

  const result = await nudgeMemberFor(r.user, clanId, userId);
  if ("error" in result) return apiError(400, result.error);
  return NextResponse.json(result);
}

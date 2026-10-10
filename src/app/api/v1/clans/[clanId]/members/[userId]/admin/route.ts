import { NextResponse } from "next/server";
import { makeAdminFor } from "@/features/clans/mutations";
import { apiError, requireApiUser } from "@/lib/api-response";

/** POST /api/v1/clans/:clanId/members/:userId/admin — hand admin over to this member (admin only; you become a member). */
export async function POST(_request: Request, { params }: { params: Promise<{ clanId: string; userId: string }> }) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const { clanId, userId } = await params;

  const result = await makeAdminFor(r.user.id, clanId, userId);
  if ("error" in result) return apiError(400, result.error);
  return NextResponse.json(result);
}

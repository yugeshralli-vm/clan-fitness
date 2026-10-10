import { NextResponse } from "next/server";
import { regenerateInviteCodeFor } from "@/features/clans/mutations";
import { apiError, requireApiUser } from "@/lib/api-response";

/** POST /api/v1/clans/:clanId/invite-code — a new invite code; the old one stops working (admin only). */
export async function POST(_request: Request, { params }: { params: Promise<{ clanId: string }> }) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const { clanId } = await params;

  const result = await regenerateInviteCodeFor(r.user.id, clanId);
  if ("error" in result) return apiError(403, result.error);
  return NextResponse.json(result);
}

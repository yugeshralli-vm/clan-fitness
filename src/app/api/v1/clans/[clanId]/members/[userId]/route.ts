import { NextResponse } from "next/server";
import { removeMemberFor } from "@/features/clans/mutations";
import { apiError, requireApiUser } from "@/lib/api-response";

/** DELETE /api/v1/clans/:clanId/members/:userId — remove a member (admin only). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ clanId: string; userId: string }> }) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const { clanId, userId } = await params;

  const result = await removeMemberFor(r.user.id, clanId, userId);
  if ("error" in result) return apiError(400, result.error);
  return new NextResponse(null, { status: 204 });
}

import { NextResponse } from "next/server";
import { leaveClanFor } from "@/features/clans/mutations";
import { apiError, requireApiUser } from "@/lib/api-response";

/** POST /api/v1/clans/:clanId/leave — leave a clan (the admin has to hand admin over first). */
export async function POST(_request: Request, { params }: { params: Promise<{ clanId: string }> }) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const { clanId } = await params;

  const result = await leaveClanFor(r.user.id, clanId);
  if ("error" in result) return apiError(400, result.error);
  return new NextResponse(null, { status: 204 });
}

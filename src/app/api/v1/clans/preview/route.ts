import { NextResponse } from "next/server";
import { getClanByInviteCode, getClanMemberCount } from "@/features/clans/queries";
import { apiError, requireApiUser } from "@/lib/api-response";

/** GET /api/v1/clans/preview?code= — the clan an invite code points to, before joining (web /join). */
export async function GET(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const code = new URL(request.url).searchParams.get("code")?.trim();
  if (!code) return apiError(400, "code is required.");

  const clan = await getClanByInviteCode(code);
  if (!clan) return apiError(404, "Invalid invite code.");
  return NextResponse.json({
    clan: { id: clan.id, name: clan.name, description: clan.description, memberCount: await getClanMemberCount(clan.id), maxSize: clan.maxSize },
  });
}

import { NextResponse } from "next/server";
import { joinClanFor } from "@/features/clans/mutations";
import { apiError, requireApiUser } from "@/lib/api-response";

/**
 * POST /api/v1/clans/join { inviteCode } — join by invite code (web /clans/join). Returns the clan
 * id and whether you were already in it (the web then goes to the clan instead of the welcome page).
 */
export async function POST(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const body = (await request.json().catch(() => null)) as { inviteCode?: string } | null;

  const result = await joinClanFor(r.user.id, body?.inviteCode ?? "");
  if ("error" in result) return apiError(400, result.error);
  return NextResponse.json(result);
}

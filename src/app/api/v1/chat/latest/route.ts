import { NextResponse } from "next/server";
import { getLatestClanMessageAt } from "@/features/clan-chat";
import { requireApiUser } from "@/lib/api-response";
import { requireClanMember } from "@/lib/api-membership";

/** GET /api/v1/chat/latest?clanId= — when the newest message was sent, for the Chat tab's unread dot. */
export async function GET(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const m = await requireClanMember(r.user.id, new URL(request.url).searchParams.get("clanId"));
  if ("error" in m) return m.error;

  return NextResponse.json({ latestMessageAt: await getLatestClanMessageAt(m.membership.clanId) });
}

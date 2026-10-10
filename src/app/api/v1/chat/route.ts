import { NextResponse } from "next/server";
import { getClanMessages, sendClanMessage } from "@/features/clan-chat";
import { apiError, requireApiUser } from "@/lib/api-response";
import { requireClanMember } from "@/lib/api-membership";

/** GET /api/v1/chat?clanId= — the clan's latest 200 messages, oldest first, with reactions (same as web). */
export async function GET(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const m = await requireClanMember(r.user.id, new URL(request.url).searchParams.get("clanId"));
  if ("error" in m) return m.error;

  const messages = await getClanMessages(m.membership.clanId, r.user.id);
  return NextResponse.json({ messages });
}

/**
 * POST /api/v1/chat { clanId, body, replyToMessageId? } — `body` may contain `@[Name](userId)`
 * mention markup, exactly like the web composer sends. Goes through the web's server action
 * (validation, reply-target check, mention/reply notifications, realtime, contract completion).
 */
export async function POST(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const body = (await request.json().catch(() => null)) as
    | { clanId?: string; body?: string; replyToMessageId?: string | null }
    | null;
  if (!body?.clanId || typeof body.body !== "string") return apiError(400, "clanId and body are required.");

  const formData = new FormData();
  formData.set("body", body.body);
  if (body.replyToMessageId) formData.set("replyToMessageId", body.replyToMessageId);
  const result = await sendClanMessage(body.clanId, undefined, formData);
  if (result?.error) return apiError(result.error === "Not authorized." ? 403 : 400, result.error);
  return NextResponse.json({ sent: true });
}

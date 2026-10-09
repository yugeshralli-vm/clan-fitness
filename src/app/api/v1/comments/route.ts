import { NextResponse } from "next/server";
import { addComment } from "@/features/comments/actions";
import { getCommentsForCheckIns } from "@/features/comments/queries";
import { apiError, requireApiUser } from "@/lib/api-response";
import { requireClanMember } from "@/lib/api-membership";

/** GET /api/v1/comments?checkInId=&clanId= — a card's comments, oldest first (same as web). */
export async function GET(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const params = new URL(request.url).searchParams;
  const checkInId = params.get("checkInId");
  const m = await requireClanMember(r.user.id, params.get("clanId"));
  if ("error" in m) return m.error;
  if (!checkInId) return apiError(400, "checkInId is required.");

  const comments = await getCommentsForCheckIns([checkInId], m.membership.clanId);
  return NextResponse.json({ comments: comments[checkInId] ?? [] });
}

/**
 * POST /api/v1/comments { checkInId, clanId, text } — `text` may contain `@[Name](userId)` mention
 * markup, exactly like the web composer sends. Goes through the web's server action (validation,
 * mention/comment notifications, realtime, contract completion).
 */
export async function POST(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const body = (await request.json().catch(() => null)) as { checkInId?: string; clanId?: string; text?: string } | null;
  if (!body?.checkInId || !body.clanId || typeof body.text !== "string") {
    return apiError(400, "checkInId, clanId and text are required.");
  }
  const result = await addComment(body.checkInId, body.clanId, body.text);
  if ("error" in result) return apiError(400, result.error);
  return NextResponse.json({ comment: result.comment });
}

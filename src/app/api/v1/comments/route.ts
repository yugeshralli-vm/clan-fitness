import { NextResponse } from "next/server";
import { addComment, addSystemPostComment } from "@/features/comments/actions";
import { getCommentsForCheckIns, getCommentsForSystemPosts } from "@/features/comments/queries";
import { apiError, requireApiUser } from "@/lib/api-response";
import { requireClanMember } from "@/lib/api-membership";

/**
 * GET /api/v1/comments?checkInId=&clanId= (or ?systemPostId= for a weekly recap) — a card's
 * comments, oldest first (same as web).
 */
export async function GET(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const params = new URL(request.url).searchParams;
  const checkInId = params.get("checkInId");
  const systemPostId = params.get("systemPostId");
  const m = await requireClanMember(r.user.id, params.get("clanId"));
  if ("error" in m) return m.error;
  if (!checkInId && !systemPostId) return apiError(400, "checkInId or systemPostId is required.");

  const clanId = m.membership.clanId;
  const comments = checkInId
    ? (await getCommentsForCheckIns([checkInId], clanId))[checkInId]
    : (await getCommentsForSystemPosts([systemPostId!], clanId))[systemPostId!];
  return NextResponse.json({ comments: comments ?? [] });
}

/**
 * POST /api/v1/comments { checkInId | systemPostId, clanId, text } — `text` may contain
 * `@[Name](userId)` mention markup, exactly like the web composer sends. Goes through the web's
 * server actions (validation, mention/comment notifications, realtime, contract completion).
 */
export async function POST(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const body = (await request.json().catch(() => null)) as
    | { checkInId?: string; systemPostId?: string; clanId?: string; text?: string }
    | null;
  if ((!body?.checkInId && !body?.systemPostId) || !body.clanId || typeof body.text !== "string") {
    return apiError(400, "checkInId or systemPostId, clanId and text are required.");
  }
  const result = body.checkInId
    ? await addComment(body.checkInId, body.clanId, body.text)
    : await addSystemPostComment(body.systemPostId!, body.clanId, body.text);
  if ("error" in result) return apiError(400, result.error);
  return NextResponse.json({ comment: result.comment });
}

import { NextResponse } from "next/server";
import { toggleReaction, toggleSystemPostReaction } from "@/features/reactions/actions";
import { getReactionsForCheckIns, getReactionsForSystemPosts } from "@/features/reactions/queries";
import type { ReactionSummary } from "@/features/reactions/types";
import { REACTION_EMOJIS } from "@/features/reactions/types";
import { apiError, requireApiUser } from "@/lib/api-response";
import { requireClanMember } from "@/lib/api-membership";

/** Same shape the web ReactionBar works with: per emoji, who reacted and whether the viewer did. */
function toResponse(summary: ReactionSummary) {
  return Object.fromEntries(
    Object.entries(summary).map(([emoji, entry]) => [
      emoji,
      { count: entry.users.length, reactedByMe: entry.reactedByMe, users: entry.users },
    ]),
  );
}

/**
 * GET /api/v1/reactions?checkInId=&clanId= (or ?systemPostId= for a weekly recap) — a card's
 * reactions with reactor names (who-reacted sheet).
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
  const summary = checkInId
    ? (await getReactionsForCheckIns([checkInId], clanId, r.user.id))[checkInId]
    : (await getReactionsForSystemPosts([systemPostId!], clanId, r.user.id))[systemPostId!];
  return NextResponse.json({ reactions: toResponse(summary ?? {}) });
}

/**
 * POST /api/v1/reactions { checkInId | systemPostId, clanId, emoji } — toggles the viewer's
 * reaction, through the same server actions the web uses (membership check, notification,
 * realtime, contract completion).
 */
export async function POST(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const body = (await request.json().catch(() => null)) as
    | { checkInId?: string; systemPostId?: string; clanId?: string; emoji?: string }
    | null;
  if ((!body?.checkInId && !body?.systemPostId) || !body.clanId || !body.emoji) {
    return apiError(400, "checkInId or systemPostId, clanId and emoji are required.");
  }
  if (!(REACTION_EMOJIS as readonly string[]).includes(body.emoji)) return apiError(400, "Unsupported emoji.");

  const result = body.checkInId
    ? await toggleReaction(body.checkInId, body.clanId, body.emoji)
    : await toggleSystemPostReaction(body.systemPostId!, body.clanId, body.emoji);
  if ("error" in result) return apiError(403, result.error);
  return NextResponse.json({ reactions: toResponse(result.summary) });
}

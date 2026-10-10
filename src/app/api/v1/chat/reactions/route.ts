import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { clanMessages } from "@/db/schema";
import { toggleClanMessageReaction } from "@/features/reactions/actions";
import { CHAT_REACTION_EMOJIS } from "@/features/reactions/types";
import { apiError, requireApiUser } from "@/lib/api-response";

/**
 * POST /api/v1/chat/reactions { messageId, clanId, emoji } — toggles the viewer's reaction on a chat
 * message through the web's server action (membership check, realtime, contract completion), and
 * returns the message's updated reactions with reactor names.
 */
export async function POST(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const body = (await request.json().catch(() => null)) as { messageId?: string; clanId?: string; emoji?: string } | null;
  if (!body?.messageId || !body.clanId || !body.emoji) return apiError(400, "messageId, clanId and emoji are required.");
  if (!(CHAT_REACTION_EMOJIS as readonly string[]).includes(body.emoji)) return apiError(400, "Unsupported emoji.");

  // The server action trusts its caller to pass a message from this clan; check it here.
  const [message] = await db
    .select({ id: clanMessages.id })
    .from(clanMessages)
    .where(and(eq(clanMessages.id, body.messageId), eq(clanMessages.clanId, body.clanId)))
    .limit(1);
  if (!message) return apiError(404, "Message not found.");

  const result = await toggleClanMessageReaction(body.messageId, body.clanId, body.emoji);
  if ("error" in result) return apiError(403, result.error);
  return NextResponse.json({ reactions: result.summary });
}

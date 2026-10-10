import { NextResponse } from "next/server";
import { getUserClans } from "@/features/clans/queries";
import { requireApiUser } from "@/lib/api-response";
import { signRealtimeToken } from "@/lib/realtime";

/**
 * GET /api/v1/realtime/token — the Android app's equivalent of the web's getRealtimeToken server
 * action: a short-lived signed token for the Railway signal server covering the user's room and
 * every clan they're in, plus the server's URL (so the app needs no build-time config for it).
 * 204 when realtime isn't configured; the app then just doesn't connect.
 */
export async function GET() {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const clanIds = (await getUserClans(r.user.id)).map((m) => m.clan.id);
  const token = signRealtimeToken(r.user.id, clanIds);
  const url = process.env.NEXT_PUBLIC_REALTIME_URL;
  if (!token || !url) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ token, clanIds, url });
}

import { NextResponse } from "next/server";
import { getNotificationsAndMarkRead } from "@/features/notifications/actions";
import { getNotificationsForUser } from "@/features/notifications/queries";
import { requireApiUser } from "@/lib/api-response";

/**
 * GET /api/v1/notifications?markRead=1 — the bell's 30 most recent notifications, newest first.
 * With markRead=1 it then marks all of them read, like opening the bell on the web; the returned
 * rows still show which were unread. `url` is a web path (/logs, /clans/:id, /clans/:id/chat…),
 * with `checkInId` for the card it's about.
 */
export async function GET(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const markRead = new URL(request.url).searchParams.get("markRead") === "1";

  const notifications = markRead ? await getNotificationsAndMarkRead() : await getNotificationsForUser(r.user.id);
  return NextResponse.json({ notifications });
}

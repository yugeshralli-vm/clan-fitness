import { NextResponse } from "next/server";
import { getUnreadNotificationCount } from "@/features/notifications/queries";
import { requireApiUser } from "@/lib/api-response";

/** The header bell's badge count — same number the web NotificationBell starts from. */
export async function GET() {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  return NextResponse.json({ count: await getUnreadNotificationCount(r.user.id) });
}

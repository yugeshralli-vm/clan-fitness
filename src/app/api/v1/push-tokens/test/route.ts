import { NextResponse } from "next/server";
import { sendTestNotification } from "@/features/notifications/actions";
import { apiError, requireApiUser } from "@/lib/api-response";

/** POST /api/v1/push-tokens/test — the web's "Send test notification", to all of your devices (web and Android). */
export async function POST() {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const result = await sendTestNotification();
  if (result.error) return apiError(400, result.error);
  return NextResponse.json({ sent: result.sent });
}

import { NextResponse } from "next/server";
import { updateNotificationPreferences } from "@/features/notifications/actions";
import { apiError, requireApiUser } from "@/lib/api-response";

const KEYS = ["notifyOnComments", "notifyOnMentions", "notifyOnReactions", "notifyOnCheckIns"] as const;

/** PUT /api/v1/me/notification-preferences { notifyOnComments, notifyOnMentions, notifyOnReactions, notifyOnCheckIns } (booleans; missing = off, like the web form). */
export async function PUT(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const body = (await request.json().catch(() => null)) as Partial<Record<(typeof KEYS)[number], boolean>> | null;
  if (!body) return apiError(400, "Invalid request body.");

  const formData = new FormData();
  for (const key of KEYS) if (body[key] === true) formData.set(key, "on");
  const result = await updateNotificationPreferences(undefined, formData);
  if (result?.error) return apiError(400, result.error);
  return NextResponse.json({ notificationPreferences: Object.fromEntries(KEYS.map((key) => [key, body[key] === true])) });
}

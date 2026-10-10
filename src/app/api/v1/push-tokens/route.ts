import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { devicePushTokens } from "@/db/schema";
import { apiError, requireApiUser } from "@/lib/api-response";

const MAX_TOKEN_LENGTH = 4096;

function readToken(body: { token?: unknown } | null) {
  return typeof body?.token === "string" && body.token.length > 0 && body.token.length <= MAX_TOKEN_LENGTH ? body.token : null;
}

/**
 * POST /api/v1/push-tokens { token } — registers this Android device's FCM token for the signed-in
 * user (the app's counterpart of the web's subscribeToPush). A token already registered to someone
 * else moves to this user: it's the same phone, now signed in as them.
 */
export async function POST(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const token = readToken(await request.json().catch(() => null));
  if (!token) return apiError(400, "token is required.");

  await db
    .insert(devicePushTokens)
    .values({ userId: r.user.id, token, platform: "android" })
    .onConflictDoUpdate({ target: devicePushTokens.token, set: { userId: r.user.id, updatedAt: new Date() } });
  return new NextResponse(null, { status: 204 });
}

/** DELETE /api/v1/push-tokens { token } — stops push to this device (push turned off, or signing out). */
export async function DELETE(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const token = readToken(await request.json().catch(() => null));
  if (!token) return apiError(400, "token is required.");

  await db.delete(devicePushTokens).where(and(eq(devicePushTokens.token, token), eq(devicePushTokens.userId, r.user.id)));
  return new NextResponse(null, { status: 204 });
}

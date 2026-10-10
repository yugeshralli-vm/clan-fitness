import "server-only";

import { createSign } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { devicePushTokens } from "@/db/schema";
import { logNotificationDelivery } from "./delivery-log";
import type { NotificationPayload } from "./types";

// Firebase Cloud Messaging (HTTP v1) for the Android app — the native counterpart of web push in
// send.ts. Authenticates with the service account in FIREBASE_SERVICE_ACCOUNT (the whole key JSON,
// set in Vercel only): a self-signed JWT is exchanged for a short-lived OAuth token, cached until
// shortly before it expires. No Firebase SDK — two HTTPS calls don't need one.

type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string };

const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";

let cachedAccount: ServiceAccount | null | undefined;
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  if (cachedAccount !== undefined) return cachedAccount;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  try {
    const parsed = raw ? (JSON.parse(raw) as ServiceAccount) : null;
    cachedAccount = parsed?.project_id && parsed.client_email && parsed.private_key ? parsed : null;
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON; Android push is disabled.");
    cachedAccount = null;
  }
  return cachedAccount;
}

const base64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

async function accessToken(account: ServiceAccount): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) return cachedAccessToken.token;

  const tokenUri = account.token_uri ?? DEFAULT_TOKEN_URI;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.private_key);
  const assertion = `${header}.${claims}.${base64url(signature)}`;

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error(`FCM auth failed: ${response.status} ${await response.text()}`);
  const { access_token, expires_in } = (await response.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = { token: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token;
}

/** FCM's way of saying this token will never work again (app uninstalled, data cleared…). */
function isDeadToken(status: number, body: string) {
  return status === 404 || body.includes("UNREGISTERED") || (status === 400 && body.includes("registration token"));
}

/**
 * Sends to every Android device the user has registered. Tokens FCM reports as gone are deleted.
 * Returns how many sends succeeded. `data` carries the in-app destination (`url`, `checkInId`) so
 * tapping the notification opens the screen it's about, like the web's service worker.
 */
export async function sendFcmNotifications(
  userId: string,
  payload: NotificationPayload & { unreadCount?: number },
): Promise<number> {
  const tokens = await db.select().from(devicePushTokens).where(eq(devicePushTokens.userId, userId));
  if (tokens.length === 0) return 0;

  const account = serviceAccount();
  if (!account) {
    await logNotificationDelivery(userId, "push", "skipped", "FIREBASE_SERVICE_ACCOUNT missing (android)");
    return 0;
  }

  let bearer: string;
  try {
    bearer = await accessToken(account);
  } catch (error) {
    console.error(error);
    await logNotificationDelivery(userId, "push", "failed", `android: ${(error as Error).message}`);
    return 0;
  }

  // FCM data values must be strings.
  const data: Record<string, string> = { type: payload.type };
  if (payload.url) data.url = payload.url;
  if (payload.checkInId) data.checkInId = payload.checkInId;
  if (payload.unreadCount !== undefined) data.unreadCount = String(payload.unreadCount);

  let sent = 0;
  await Promise.all(
    tokens.map(async (row) => {
      try {
        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token: row.token,
              notification: { title: payload.title, body: payload.body },
              data,
              android: { priority: "high", notification: { channel_id: "default" } },
            },
          }),
        });
        if (response.ok) {
          sent += 1;
          await logNotificationDelivery(userId, "push", "sent", "android");
          return;
        }
        const body = await response.text();
        if (isDeadToken(response.status, body)) {
          await db.delete(devicePushTokens).where(eq(devicePushTokens.id, row.id));
          await logNotificationDelivery(userId, "push", "failed", `android ${response.status} (token removed)`);
        } else {
          await logNotificationDelivery(userId, "push", "failed", `android ${response.status}: ${body}`);
        }
      } catch (error) {
        console.error("Failed to send FCM notification:", error);
        await logNotificationDelivery(userId, "push", "failed", `android: ${(error as Error).message}`);
      }
    }),
  );
  return sent;
}

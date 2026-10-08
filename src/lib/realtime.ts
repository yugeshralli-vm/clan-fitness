import "server-only";

import { createHmac } from "node:crypto";

// Talks to the clan chat signal server on Railway (realtime/server.mjs). Both functions are
// no-ops when the env vars aren't set, so local dev and previews fall back to plain polling.

const TOKEN_TTL_SECONDS = 10 * 60;
const PUBLISH_TIMEOUT_MS = 1500;

function config() {
  const url = process.env.NEXT_PUBLIC_REALTIME_URL;
  const secret = process.env.REALTIME_SECRET;
  return url && secret ? { url, secret } : null;
}

/** Short-lived token that lets this user's browser join one clan's room. Only checked at connect
 * time, so the TTL just bounds how long a leaked URL stays usable — reconnects fetch a fresh one. */
export function signRealtimeToken(userId: string, clanId: string): string | null {
  const cfg = config();
  if (!cfg) return null;
  const payload = Buffer.from(
    JSON.stringify({ u: userId, c: clanId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS }),
  ).toString("base64url");
  const signature = createHmac("sha256", cfg.secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/** Tells every open chat in this clan to refetch. Best-effort: a failure here must never fail the
 * write that triggered it — clients still pick the change up on their fallback poll. */
export async function publishClanChange(clanId: string): Promise<void> {
  const cfg = config();
  if (!cfg) return;
  try {
    await fetch(new URL("/publish", cfg.url), {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.secret}`, "content-type": "application/json" },
      body: JSON.stringify({ clanId }),
      signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("realtime publish failed", error);
  }
}

import "server-only";

import { createHmac } from "node:crypto";
import type { RealtimeEvent } from "./realtime-events";

// Talks to the signal server on Railway (realtime/server.mjs). Everything here is a no-op when the
// env vars aren't set, so local dev and previews fall back to plain polling.

const TOKEN_TTL_SECONDS = 10 * 60;
const PUBLISH_TIMEOUT_MS = 1500;

function config() {
  const url = process.env.NEXT_PUBLIC_REALTIME_URL;
  const secret = process.env.REALTIME_SECRET;
  return url && secret ? { url, secret } : null;
}

/** Short-lived token that lets this user's browser join their own room plus one room per clan.
 * Only checked at connect time, so the TTL just bounds how long a leaked URL stays usable —
 * reconnects fetch a fresh one (which also picks up clans joined since). */
export function signRealtimeToken(userId: string, clanIds: string[]): string | null {
  const cfg = config();
  if (!cfg) return null;
  const payload = Buffer.from(
    JSON.stringify({ u: userId, c: clanIds, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS }),
  ).toString("base64url");
  const signature = createHmac("sha256", cfg.secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

type PublishedEvent = { room: string; event: RealtimeEvent; actor?: string; data?: unknown };

/** Best-effort: a failure here must never fail the write that triggered it — clients still pick
 * the change up on their fallback poll or next visit. */
async function publish(events: PublishedEvent[]): Promise<void> {
  const cfg = config();
  if (!cfg || events.length === 0) return;
  try {
    await fetch(new URL("/publish", cfg.url), {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.secret}`, "content-type": "application/json" },
      body: JSON.stringify({ events }),
      signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("realtime publish failed", error);
  }
}

/** Tells everyone with any of these clans open that something changed. `actor` is the user who
 * caused it, so their own UI can skip things like unread dots. `data` is relayed as-is — only
 * for things every member of the clan may already see. */
export function publishClanEvent(clanIds: string | string[], event: RealtimeEvent, actor?: string, data?: unknown) {
  const ids = Array.isArray(clanIds) ? clanIds : [clanIds];
  return publish(ids.map((clanId) => ({ room: `clan:${clanId}`, event, actor, data })));
}

export function publishUserEvent(userId: string, event: RealtimeEvent) {
  return publish([{ room: `user:${userId}`, event }]);
}

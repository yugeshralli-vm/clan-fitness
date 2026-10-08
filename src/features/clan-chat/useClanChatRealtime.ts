"use client";

import { useEffect, useRef } from "react";
import { getClanChatRealtimeToken } from "./actions";

const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL;
/** Without the realtime server configured (local dev, previews) this is the only update path. */
const POLL_ONLY_INTERVAL_MS = 2000;
/** Safety net while the socket is down/reconnecting — slower, since it's not the main path. */
const FALLBACK_POLL_INTERVAL_MS = 15_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Calls `onChange` whenever another member changes this clan's chat. Connects to the Railway
 * signal server (realtime/server.mjs), which only says "something changed" — the actual messages
 * still come from the normal server action. Falls back to polling whenever the socket isn't open,
 * so a Railway outage degrades to slower updates instead of a dead chat.
 */
export function useClanChatRealtime(clanId: string, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const refresh = () => onChangeRef.current();

    if (!REALTIME_URL) {
      const interval = setInterval(refresh, POLL_ONLY_INTERVAL_MS);
      return () => clearInterval(interval);
    }

    let socket: WebSocket | null = null;
    let disposed = false;
    let connecting = false;
    let attempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    // Always running; skips its tick while the socket is healthy.
    const fallbackPoll = setInterval(() => {
      if (socket?.readyState !== WebSocket.OPEN) refresh();
    }, FALLBACK_POLL_INTERVAL_MS);

    function scheduleReconnect() {
      if (disposed) return;
      const delay = Math.min(1000 * 2 ** attempts, MAX_RECONNECT_DELAY_MS);
      attempts += 1;
      reconnectTimer = setTimeout(connect, delay);
    }

    async function connect() {
      clearTimeout(reconnectTimer);
      connecting = true;
      const token = await getClanChatRealtimeToken(clanId).catch(() => null);
      connecting = false;
      if (disposed) return;
      if (!token) return scheduleReconnect();

      const url = new URL(REALTIME_URL!);
      url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
      url.searchParams.set("token", token);
      const ws = new WebSocket(url);
      socket = ws;

      ws.onopen = () => {
        attempts = 0;
        // Anything sent while we were disconnected never produced a frame for us.
        refresh();
      };
      ws.onmessage = refresh;
      ws.onclose = () => {
        if (socket === ws) socket = null;
        scheduleReconnect();
      };
    }

    // Phones suspend background tabs and quietly kill their sockets — catch up when we're back.
    function handleVisibility() {
      if (document.visibilityState !== "visible") return;
      refresh();
      if (!socket && !connecting) {
        attempts = 0;
        connect();
      }
    }

    connect();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      clearInterval(fallbackPoll);
      clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      socket?.close();
    };
  }, [clanId]);
}

"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeEvent } from "@/lib/realtime-events";
import { getRealtimeToken } from "./actions";

const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL;
const MAX_RECONNECT_DELAY_MS = 30_000;
/** Coalesces bursts (one check-in fans out to several clans + a notification each) into one refetch. */
const COALESCE_MS = 250;
/** How often this tab re-announces "still typing" — well under TYPING_VISIBLE_MS so the indicator
 * doesn't flicker off between pings while someone keeps typing. */
const TYPING_SEND_INTERVAL_MS = 2500;
/** How long "X is typing…" stays up after their last ping (they stopped, or left without sending). */
const TYPING_VISIBLE_MS = 4000;

/** A "changed" frame from the server, or a synthetic "resync" after the tab comes back to the
 * foreground (phones suspend background tabs and silently drop their sockets, so anything could
 * have been missed). Frames never carry content — subscribers refetch through server actions. */
export type RealtimeFrame =
  | { type: "changed"; event: RealtimeEvent; clanId?: string; actor?: string; data?: unknown }
  | { type: "resync" };

type Listener = (frame: RealtimeFrame) => void;
type TypingListener = (clanId: string, userId: string) => void;
type Status = "disabled" | "connecting" | "open";

type RealtimeContextValue = {
  status: Status;
  joinedClanIds: ReadonlySet<string>;
  subscribe: (listener: Listener) => () => void;
  /** Reconnect with a fresh token so it covers `clanId` — at most once per clan per tab, so a
   * clan the server keeps leaving out (not actually a member) can't cause a reconnect loop. */
  requestJoin: (clanId: string) => void;
  /** clanId -> user ids with the app open right now. Absent while disconnected (unknown, not empty). */
  presence: ReadonlyMap<string, readonly string[]>;
  subscribeTyping: (listener: TypingListener) => () => void;
  sendTyping: (clanId: string) => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/**
 * One WebSocket per tab to the Railway signal server (realtime/server.mjs), shared by every
 * subscriber via useRealtime. The socket joins this user's room plus a room per clan they're in.
 * Without NEXT_PUBLIC_REALTIME_URL it stays "disabled" and subscribers fall back to polling.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>(REALTIME_URL ? "connecting" : "disabled");
  const [joinedClanIds, setJoinedClanIds] = useState<ReadonlySet<string>>(() => new Set());
  const listenersRef = useRef(new Set<Listener>());
  const reconnectRef = useRef<() => void>(() => {});
  const joinRequestedRef = useRef(new Set<string>());
  const [presence, setPresence] = useState<ReadonlyMap<string, readonly string[]>>(() => new Map());
  const typingListenersRef = useRef(new Set<TypingListener>());
  const sendRef = useRef<(message: object) => void>(() => {});

  useEffect(() => {
    if (!REALTIME_URL) return;

    let socket: WebSocket | null = null;
    let disposed = false;
    let connecting = false;
    let attempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const emit = (frame: RealtimeFrame) => {
      for (const listener of listenersRef.current) listener(frame);
    };

    function scheduleReconnect() {
      if (disposed) return;
      const delay = Math.min(1000 * 2 ** attempts, MAX_RECONNECT_DELAY_MS);
      attempts += 1;
      reconnectTimer = setTimeout(connect, delay);
    }

    async function connect() {
      clearTimeout(reconnectTimer);
      connecting = true;
      setStatus("connecting");
      const auth = await getRealtimeToken().catch(() => null);
      connecting = false;
      if (disposed) return;
      if (!auth) return scheduleReconnect();

      const url = new URL(REALTIME_URL!);
      url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
      url.searchParams.set("token", auth.token);
      const ws = new WebSocket(url);
      socket = ws;

      ws.onopen = () => {
        attempts = 0;
        setJoinedClanIds(new Set(auth.clanIds));
        setStatus("open");
      };
      ws.onmessage = (message) => {
        try {
          const frame = JSON.parse(String(message.data));
          if (frame?.type === "changed") emit(frame);
          else if (frame?.type === "presence") {
            setPresence((prev) => new Map(prev).set(frame.clanId, frame.userIds));
          } else if (frame?.type === "typing") {
            for (const listener of typingListenersRef.current) listener(frame.clanId, frame.userId);
          }
        } catch {
          // Ignore anything that isn't one of our frames.
        }
      };
      ws.onclose = () => {
        if (socket !== ws) return;
        socket = null;
        if (disposed) return;
        setStatus("connecting");
        setPresence(new Map());
        scheduleReconnect();
      };
    }

    sendRef.current = (message) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    };

    // Swaps the socket for one with a fresh token — e.g. after joining a clan the current token
    // doesn't cover. The old socket's onclose is a no-op once it's no longer `socket`.
    reconnectRef.current = () => {
      if (connecting) return;
      const old = socket;
      socket = null;
      old?.close();
      attempts = 0;
      connect();
    };

    function handleVisibility() {
      if (document.visibilityState !== "visible") return;
      emit({ type: "resync" });
      if (!socket && !connecting) {
        attempts = 0;
        connect();
      }
    }

    connect();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      reconnectRef.current = () => {};
      sendRef.current = () => {};
      clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      socket?.close();
    };
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      status,
      joinedClanIds,
      subscribe: (listener) => {
        listenersRef.current.add(listener);
        return () => listenersRef.current.delete(listener);
      },
      requestJoin: (clanId) => {
        if (joinRequestedRef.current.has(clanId)) return;
        joinRequestedRef.current.add(clanId);
        reconnectRef.current();
      },
      presence,
      subscribeTyping: (listener) => {
        typingListenersRef.current.add(listener);
        return () => typingListenersRef.current.delete(listener);
      },
      sendTyping: (clanId) => sendRef.current({ type: "typing", clanId }),
    }),
    [status, joinedClanIds, presence],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/**
 * Calls `onChange` when one of `events` happens — in `clanId` if given, otherwise in any of the
 * user's clans or their own room. Also calls it after (re)connecting and when the tab returns to
 * the foreground, since frames sent in the meantime were missed.
 *
 * While the socket isn't open for this clan (Railway down, reconnecting, not configured, or a
 * clan joined after the token was issued) it polls every `fallbackPollMs` instead, if given — so
 * an outage degrades to the old polling behavior rather than a frozen screen.
 *
 * `onChange` receives the frame (undefined for poll ticks and catch-ups), e.g. to ignore the
 * viewer's own actions via `frame.actor`.
 */
export function useRealtime({
  events,
  clanId,
  fallbackPollMs,
  onChange,
}: {
  events: readonly RealtimeEvent[];
  clanId?: string;
  fallbackPollMs?: number;
  onChange: (frame?: Extract<RealtimeFrame, { type: "changed" }>) => void;
}) {
  const ctx = useContext(RealtimeContext);
  const status = ctx?.status ?? "disabled";
  const live = status === "open" && (!clanId || ctx!.joinedClanIds.has(clanId));
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const eventsKey = events.join(",");

  useEffect(() => {
    if (!ctx) return;
    const wanted = new Set(eventsKey.split(","));
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pendingFrame: Extract<RealtimeFrame, { type: "changed" }> | undefined;
    return ctx.subscribe((frame) => {
      if (frame.type === "changed") {
        if (!wanted.has(frame.event)) return;
        if (clanId && frame.clanId !== clanId) return;
        // Keep the latest frame; a burst is reported once, with its last frame.
        pendingFrame = frame;
      } else {
        pendingFrame = undefined;
      }
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        onChangeRef.current(pendingFrame);
      }, COALESCE_MS);
    });
    // ctx changes identity on every status change; resubscribing then is harmless.
  }, [ctx, clanId, eventsKey]);

  // Catch up whenever this subscriber goes live — frames sent while it wasn't were never seen.
  const wasLiveRef = useRef(live);
  useEffect(() => {
    if (live && !wasLiveRef.current) onChangeRef.current();
    wasLiveRef.current = live;
  }, [live]);

  useEffect(() => {
    if (live || !fallbackPollMs) return;
    const interval = setInterval(() => onChangeRef.current(), fallbackPollMs);
    return () => clearInterval(interval);
  }, [live, fallbackPollMs]);

  // The socket's token predates this clan (just joined/created it) — get one that covers it.
  const requestJoin = ctx?.requestJoin;
  const needsJoin = status === "open" && !!clanId && !live;
  useEffect(() => {
    if (needsJoin && clanId) requestJoin?.(clanId);
  }, [needsJoin, clanId, requestJoin]);
}

/** User ids in `clanId` with the app open right now (including the viewer), or null while that
 * isn't known — disconnected, or realtime isn't configured. */
export function usePresence(clanId: string): readonly string[] | null {
  const ctx = useContext(RealtimeContext);
  return ctx?.presence.get(clanId) ?? null;
}

/**
 * Who else is typing in `clanId`'s chat, plus `notifyTyping` to call on every keystroke (it
 * throttles itself). Someone drops off after TYPING_VISIBLE_MS without a ping, or as soon as
 * their message lands.
 */
export function useTypingIndicator(clanId: string, currentUserId: string) {
  const ctx = useContext(RealtimeContext);
  const [typing, setTyping] = useState<ReadonlyMap<string, number>>(() => new Map());
  const lastSentRef = useRef(0);
  const subscribeTyping = ctx?.subscribeTyping;
  const subscribe = ctx?.subscribe;
  const sendTyping = ctx?.sendTyping;

  useEffect(() => {
    if (!subscribeTyping || !subscribe) return;
    const unsubscribeTyping = subscribeTyping((frameClanId, userId) => {
      if (frameClanId !== clanId || userId === currentUserId) return;
      setTyping((prev) => new Map(prev).set(userId, Date.now() + TYPING_VISIBLE_MS));
    });
    const unsubscribeChanges = subscribe((frame) => {
      if (frame.type !== "changed" || frame.event !== "chat_message" || frame.clanId !== clanId || !frame.actor) return;
      const actor = frame.actor;
      setTyping((prev) => {
        if (!prev.has(actor)) return prev;
        const next = new Map(prev);
        next.delete(actor);
        return next;
      });
    });
    return () => {
      unsubscribeTyping();
      unsubscribeChanges();
    };
  }, [subscribeTyping, subscribe, clanId, currentUserId]);

  // Expire stale entries — scheduled for the soonest expiry rather than ticking on an interval.
  useEffect(() => {
    if (typing.size === 0) return;
    const soonest = Math.min(...typing.values());
    const timeout = setTimeout(
      () => setTyping((prev) => new Map([...prev].filter(([, expiresAt]) => expiresAt > Date.now()))),
      Math.max(0, soonest - Date.now()),
    );
    return () => clearTimeout(timeout);
  }, [typing]);

  function notifyTyping() {
    const now = Date.now();
    if (now - lastSentRef.current < TYPING_SEND_INTERVAL_MS) return;
    lastSentRef.current = now;
    sendTyping?.(clanId);
  }

  /** Call after sending, so the next keystroke announces typing again right away. */
  function resetTyping() {
    lastSentRef.current = 0;
  }

  return { typingUserIds: [...typing.keys()], notifyTyping, resetTyping };
}

/** Every frame of one event, uncoalesced and with no catch-up or polling — for events that carry
 * their own `data` and are shown once as they happen (e.g. contract moments), rather than being a
 * cue to refetch. Missed frames (disconnected, tab in background) are simply not shown. */
export function useRealtimeStream(
  event: RealtimeEvent,
  onFrame: (frame: Extract<RealtimeFrame, { type: "changed" }>) => void,
) {
  const ctx = useContext(RealtimeContext);
  const subscribe = ctx?.subscribe;
  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  });

  useEffect(() => {
    if (!subscribe) return;
    return subscribe((frame) => {
      if (frame.type === "changed" && frame.event === event) onFrameRef.current(frame);
    });
  }, [subscribe, event]);
}

/** Whether `userId` has the app open, per presence in any of the viewer's clans (presence is only
 * ever sent for clans the viewer is in). False while presence isn't known. */
export function useIsOnline(userId: string): boolean {
  const ctx = useContext(RealtimeContext);
  if (!ctx) return false;
  for (const userIds of ctx.presence.values()) {
    if (userIds.includes(userId)) return true;
  }
  return false;
}

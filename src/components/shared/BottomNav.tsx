"use client";

import { Activity, MessageSquare, Plus, Shield, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use, useEffect, useState, type ComponentType } from "react";
import type { ClanChatEntry } from "@/features/clan-chat";
import { useRealtime } from "@/features/realtime";
import { useActiveClanId, type ClanOption } from "@/lib/active-clan";
import { triggerHaptic } from "@/lib/haptics";

export type FeedCheckInEntry = { clanId: string; latestCheckInAt: Date | null };

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  match: (pathname: string) => boolean;
  unreadDot?: "feed" | "chat";
  // Renders as a raised accent-filled circular button (the center "Log" CTA) instead of a plain
  // icon+label, regardless of whether it's the active route.
  emphasize?: boolean;
};

function feedSeenKey(clanId: string) {
  return `feed-seen:${clanId}`;
}

// Written by ClanChatThread itself (the chat page marks itself seen on open) — BottomNav only
// ever reads this one, unlike feedSeenKey below which BottomNav both reads and writes.
function chatSeenKey(clanId: string) {
  return `clan-chat-seen:${clanId}`;
}

export function BottomNav({
  currentUserId,
  clans,
  latestFeedCheckInAtByClan,
  latestClanMessageAtByClan,
}: {
  currentUserId: string;
  clans: ClanOption[];
  latestFeedCheckInAtByClan: Promise<FeedCheckInEntry[]>;
  latestClanMessageAtByClan: Promise<ClanChatEntry[]>;
}) {
  const pathname = usePathname();
  const [seenAt, setSeenAt] = useState<Date | null>(null);
  const [chatSeenAt, setChatSeenAt] = useState<Date | null>(null);
  const clanId = useActiveClanId(pathname, clans);
  // Activity pushed by the realtime server since the layout's timestamps were fetched — tagged
  // with its clan so switching clans doesn't carry another clan's dot over.
  const [liveFeedAt, setLiveFeedAt] = useState<{ clanId: string; at: Date } | null>(null);
  const [liveChatAt, setLiveChatAt] = useState<{ clanId: string; at: Date } | null>(null);

  // Other members' posts/messages only, and not while already looking at that page (its own
  // "seen" timestamp was written on arrival, so a newer live timestamp would light the dot there).
  useRealtime({
    events: ["feed_post"],
    clanId: clanId ?? undefined,
    onChange: (frame) => {
      if (!clanId || !frame || frame.actor === currentUserId || pathname === `/clans/${clanId}`) return;
      setLiveFeedAt({ clanId, at: new Date() });
    },
  });
  useRealtime({
    events: ["chat_message"],
    clanId: clanId ?? undefined,
    onChange: (frame) => {
      if (!clanId || !frame || frame.actor === currentUserId || pathname === `/clans/${clanId}/chat`) return;
      setLiveChatAt({ clanId, at: new Date() });
    },
  });

  // Reads localStorage, which only exists in the browser — inherently can't be derived during render.
  useEffect(() => {
    if (!clanId) return;
    const stored = localStorage.getItem(feedSeenKey(clanId));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeenAt(stored ? new Date(stored) : null);
    const storedChat = localStorage.getItem(chatSeenKey(clanId));
    setChatSeenAt(storedChat ? new Date(storedChat) : null);
  }, [clanId]);

  useEffect(() => {
    if (!clanId || pathname !== `/clans/${clanId}`) return;
    const now = new Date();
    localStorage.setItem(feedSeenKey(clanId), now.toISOString());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeenAt(now);
  }, [clanId, pathname]);

  // Re-reads the chat-seen timestamp whenever the chat page itself is visited — ClanChatThread
  // writes it, but this component's own state (set from the read above) wouldn't otherwise know
  // it changed until the next full remount.
  useEffect(() => {
    if (!clanId || pathname !== `/clans/${clanId}/chat`) return;
    const stored = localStorage.getItem(chatSeenKey(clanId));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChatSeenAt(stored ? new Date(stored) : new Date());
  }, [clanId, pathname]);

  const items: NavItem[] = [
    ...(clanId
      ? [
          {
            href: `/clans/${clanId}`,
            label: "Feed",
            icon: Activity,
            match: (p: string) => p === `/clans/${clanId}`,
            unreadDot: "feed" as const,
          },
          {
            href: `/clans/${clanId}/manage`,
            label: "Clan",
            icon: Shield,
            match: (p: string) => p.startsWith(`/clans/${clanId}/manage`),
          },
        ]
      : []),
    { href: "/logs", label: "Log", icon: Plus, match: (p) => p === "/logs", emphasize: true },
    ...(clanId
      ? [
          {
            href: `/clans/${clanId}/chat`,
            label: "Chat",
            icon: MessageSquare,
            match: (p: string) => p === `/clans/${clanId}/chat`,
            unreadDot: "chat" as const,
          },
        ]
      : []),
    { href: "/profile", label: "Profile", icon: User, match: (p) => p.startsWith("/profile") },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-surface-border bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => triggerHaptic()}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold ${
              item.emphasize ? "text-foreground" : active ? "text-accent" : "text-foreground-tertiary"
            }`}
          >
            <span className="relative">
              {item.emphasize ? (
                <span className="-mt-6 flex size-14 flex-col items-center justify-center gap-0.5 rounded-full bg-accent">
                  <Icon size={20} strokeWidth={2.5} className="text-accent-foreground" />
                  <span className="text-[10px] font-bold text-accent-foreground">{item.label}</span>
                </span>
              ) : (
                <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
              )}
              {item.unreadDot === "feed" && clanId && (
                <Suspense fallback={null}>
                  <FeedUnreadDot
                    promise={latestFeedCheckInAtByClan}
                    clanId={clanId}
                    seenAt={seenAt}
                    liveAt={liveFeedAt?.clanId === clanId ? liveFeedAt.at : null}
                  />
                </Suspense>
              )}
              {item.unreadDot === "chat" && clanId && (
                <Suspense fallback={null}>
                  <ChatUnreadDot
                    promise={latestClanMessageAtByClan}
                    clanId={clanId}
                    seenAt={chatSeenAt}
                    liveAt={liveChatAt?.clanId === clanId ? liveChatAt.at : null}
                  />
                </Suspense>
              )}
            </span>
            {!item.emphasize && item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function latest(a: Date | null, b: Date | null) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/** Isolated so only this leaf ever suspends — the nav links and icon render immediately regardless. */
function FeedUnreadDot({
  promise,
  clanId,
  seenAt,
  liveAt,
}: {
  promise: Promise<FeedCheckInEntry[]>;
  clanId: string;
  seenAt: Date | null;
  liveAt: Date | null;
}) {
  const entries = use(promise);
  const latestCheckInAt = latest(entries.find((e) => e.clanId === clanId)?.latestCheckInAt ?? null, liveAt);
  const hasUnread = !!latestCheckInAt && (!seenAt || seenAt < latestCheckInAt);
  if (!hasUnread) return null;
  return <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-danger" />;
}

function ChatUnreadDot({
  promise,
  clanId,
  seenAt,
  liveAt,
}: {
  promise: Promise<ClanChatEntry[]>;
  clanId: string;
  seenAt: Date | null;
  liveAt: Date | null;
}) {
  const entries = use(promise);
  const latestMessageAt = latest(entries.find((e) => e.clanId === clanId)?.latestMessageAt ?? null, liveAt);
  const hasUnread = !!latestMessageAt && (!seenAt || seenAt < latestMessageAt);
  if (!hasUnread) return null;
  return <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-danger" />;
}

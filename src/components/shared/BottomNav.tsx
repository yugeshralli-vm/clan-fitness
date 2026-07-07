"use client";

import { Activity, House, Shield, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use, useEffect, useState, type ComponentType } from "react";
import { useActiveClanId, type ClanOption } from "@/lib/active-clan";

export type FeedCheckInEntry = { clanId: string; latestCheckInAt: Date | null };

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  match: (pathname: string) => boolean;
  showUnreadDot?: boolean;
};

function feedSeenKey(clanId: string) {
  return `feed-seen:${clanId}`;
}

export function BottomNav({
  clans,
  latestFeedCheckInAtByClan,
}: {
  clans: ClanOption[];
  latestFeedCheckInAtByClan: Promise<FeedCheckInEntry[]>;
}) {
  const pathname = usePathname();
  const [seenAt, setSeenAt] = useState<Date | null>(null);
  const clanId = useActiveClanId(pathname, clans);

  // Reads localStorage, which only exists in the browser — inherently can't be derived during render.
  useEffect(() => {
    if (!clanId) return;
    const stored = localStorage.getItem(feedSeenKey(clanId));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeenAt(stored ? new Date(stored) : null);
  }, [clanId]);

  useEffect(() => {
    if (!clanId || pathname !== `/clans/${clanId}`) return;
    const now = new Date();
    localStorage.setItem(feedSeenKey(clanId), now.toISOString());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeenAt(now);
  }, [clanId, pathname]);

  const items: NavItem[] = [
    ...(clanId
      ? [
          {
            href: `/clans/${clanId}`,
            label: "Feed",
            icon: Activity,
            match: (p: string) => p === `/clans/${clanId}`,
            showUnreadDot: true,
          },
        ]
      : []),
    { href: "/logs", label: "Logs", icon: House, match: (p) => p === "/logs" },
    ...(clanId
      ? [
          {
            href: `/clans/${clanId}/manage`,
            label: "Clan",
            icon: Shield,
            match: (p: string) => p.startsWith(`/clans/${clanId}/manage`),
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
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold ${
              active ? "text-accent" : "text-foreground-tertiary"
            }`}
          >
            <span className="relative">
              <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
              {item.showUnreadDot && clanId && (
                <Suspense fallback={null}>
                  <FeedUnreadDot promise={latestFeedCheckInAtByClan} clanId={clanId} seenAt={seenAt} />
                </Suspense>
              )}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Isolated so only this leaf ever suspends — the nav links and icon render immediately regardless. */
function FeedUnreadDot({
  promise,
  clanId,
  seenAt,
}: {
  promise: Promise<FeedCheckInEntry[]>;
  clanId: string;
  seenAt: Date | null;
}) {
  const entries = use(promise);
  const latestCheckInAt = entries.find((e) => e.clanId === clanId)?.latestCheckInAt ?? null;
  const hasUnread = !!latestCheckInAt && (!seenAt || seenAt < latestCheckInAt);
  if (!hasUnread) return null;
  return <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-danger" />;
}

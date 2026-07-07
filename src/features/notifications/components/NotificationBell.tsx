"use client";

import { Activity, AtSign, Bell, Heart, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, use, useState, useTransition, type ComponentType } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { getNotificationsAndMarkRead } from "../actions";
import { formatRelativeTime } from "../format";
import type { NotificationRow } from "../queries";
import type { NotificationType } from "../types";

const TYPE_ICON: Record<NotificationType, ComponentType<{ size?: number; className?: string }>> = {
  comment: MessageCircle,
  mention: AtSign,
  reaction: Heart,
  check_in: Activity,
  missed_log: Bell,
};

export function NotificationBell({ initialUnreadCount }: { initialUnreadCount: Promise<number> }) {
  const [open, setOpen] = useState(false);
  // Replaces a plain unreadCount state: the resolved count only becomes known once the promise
  // settles (inside the Suspense-isolated leaf below), so "cleared" is the one thing this
  // component can control synchronously on open — the leaf combines both to decide what to show.
  const [cleared, setCleared] = useState(false);
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpen() {
    setOpen(true);
    setCleared(true);
    startTransition(async () => {
      setItems(await getNotificationsAndMarkRead());
    });
  }

  function handleItemClick(item: NotificationRow) {
    setOpen(false);
    if (!item.url) return;
    const url = item.checkInId ? `${item.url}?checkIn=${item.checkInId}` : item.url;
    router.push(url);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative flex min-h-11 min-w-11 items-center justify-center text-foreground-tertiary hover:text-foreground"
      >
        <Bell size={22} strokeWidth={1.75} />
        <Suspense fallback={null}>
          <UnreadBadge countPromise={initialUnreadCount} cleared={cleared} />
        </Suspense>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Notifications">
        {items === null ? (
          <p className="py-6 text-center text-sm text-foreground-tertiary">{pending ? "Loading..." : ""}</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground-tertiary">You&apos;re all caught up.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = TYPE_ICON[item.type];
              const wasUnread = item.readAt === null;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-background ${
                      wasUnread ? "bg-accent/5" : ""
                    }`}
                  >
                    <Icon size={18} className="mt-0.5 shrink-0 text-foreground-tertiary" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{item.title}</span>
                      <span className="block truncate text-xs text-foreground-tertiary">{item.body}</span>
                    </span>
                    <span className="shrink-0 text-xs text-foreground-muted">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </BottomSheet>
    </>
  );
}

/** Isolated so only this leaf ever suspends — the bell icon and button render immediately regardless. */
function UnreadBadge({ countPromise, cleared }: { countPromise: Promise<number>; cleared: boolean }) {
  const count = use(countPromise);
  const display = cleared ? 0 : count;
  if (display <= 0) return null;
  return (
    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
      {display > 9 ? "9+" : display}
    </span>
  );
}

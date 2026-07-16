import { Bell, Heart, MessageCircle } from "lucide-react";

/** Static recreation of a notification + reaction/comment (see NotificationBell.tsx, CommentThread.tsx). */
export function NotificationVignette() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface p-3">
        <Bell size={16} className="shrink-0 text-accent" aria-hidden />
        <p className="text-sm text-foreground">
          <span className="font-semibold">Priya</span> hasn&apos;t checked in today
        </p>
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-surface-border bg-surface p-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground-secondary"
          aria-hidden
        >
          A
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-sm text-foreground-secondary">
            <span className="font-semibold text-foreground">Aswanth</span>: nice steps today 👀
          </p>
          <div className="flex items-center gap-3 text-xs text-foreground-tertiary">
            <span className="flex items-center gap-1">
              <Heart size={13} aria-hidden /> 3
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={13} aria-hidden /> 1
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

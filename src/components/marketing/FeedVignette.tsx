/** Static recreation of a day's check-in card (see FeedList.tsx) — example content, not live data. */
export function FeedVignette() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-surface-border bg-surface p-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground-secondary"
        aria-hidden
      >
        R
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">Rakesh</span>
          <span className="text-xs text-foreground-muted">6:48 AM</span>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-foreground-secondary">
          <span aria-hidden>💪</span> Worked out — &quot;leg day&quot;
        </p>
        <p className="flex items-center gap-1.5 text-sm text-foreground-secondary">
          <span aria-hidden>👟</span> Logged 9,400 steps
        </p>
        <p className="flex items-center gap-1.5 text-sm text-foreground-secondary">
          <span aria-hidden>🥗</span> Nailed it — &quot;grilled chicken, rice&quot;
        </p>
      </div>
    </div>
  );
}

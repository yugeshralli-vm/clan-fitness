// Takes a pre-computed level, not totalPoints — the level curve config (appConfig) is fetched
// once per page and mapped over however many users are being rendered (a chat message list, a
// member list), rather than every row independently re-fetching config or recomputing the curve.
export function LevelBadge({ level, className = "" }: { level: number; className?: string }) {
  const tierClass =
    level >= 25
      ? "border-amber-400/60 bg-gradient-to-r from-amber-400/20 to-yellow-300/20 text-amber-600"
      : level >= 10
        ? "border-accent/60 bg-accent/10 text-accent"
        : "border-surface-border bg-surface text-foreground-tertiary";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold tracking-tight ${tierClass} ${className}`}
    >
      Lv {level}
    </span>
  );
}

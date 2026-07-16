/** Static recreation of a clan leaderboard (see ClanLeaderboardSection.tsx) — example content, not live data. */
const ROWS = [
  { name: "Priya", steps: "12.4K", streak: 9, highlight: true },
  { name: "Rakesh", steps: "9.4K", streak: 4, highlight: false },
  { name: "Aswanth", steps: "6.1K", streak: 2, highlight: false },
];

export function LeaderboardVignette() {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-surface-border bg-surface p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
        This week
      </p>
      <ul className="flex flex-col divide-y divide-surface-border">
        {ROWS.map((row) => (
          <li key={row.name} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                row.highlight ? "bg-accent text-accent-foreground" : "bg-background text-foreground-secondary"
              }`}
              aria-hidden
            >
              {row.name.charAt(0)}
            </div>
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{row.name}</span>
            <span className="shrink-0 text-sm font-semibold text-accent">{row.steps}</span>
            <span className="shrink-0 text-sm font-semibold text-ember">{row.streak}🔥</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

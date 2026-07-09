import type { getNotificationDeliveryStats } from "../queries";

type Stats = Awaited<ReturnType<typeof getNotificationDeliveryStats>>;

const STATUS_LABEL: Record<string, string> = { sent: "Sent", failed: "Failed", skipped: "Skipped" };

export function NotificationHealthSection({ stats }: { stats: Stats }) {
  const { counts, recentFailures } = stats;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-1 rounded-xl border border-surface-border bg-surface p-5">
        <h2 className="mb-2 font-semibold text-foreground">Delivery counts</h2>
        {counts.length === 0 ? (
          <p className="text-sm text-foreground-tertiary">No delivery attempts logged yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-surface-border">
            {counts.map((row) => (
              <li
                key={`${row.channel}-${row.status}`}
                className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
              >
                <span className="text-sm text-foreground-secondary">
                  {row.channel} — {STATUS_LABEL[row.status] ?? row.status}
                </span>
                <span className="text-sm font-semibold text-foreground">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-1 rounded-xl border border-surface-border bg-surface p-5">
        <h2 className="mb-2 font-semibold text-foreground">Recent failures</h2>
        {recentFailures.length === 0 ? (
          <p className="text-sm text-foreground-tertiary">None.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-surface-border">
            {recentFailures.map((row) => (
              <li key={row.id} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground-secondary">
                    {row.channel} — {STATUS_LABEL[row.status] ?? row.status}
                  </span>
                  <time className="text-xs text-foreground-muted">{row.createdAt.toLocaleString("en-US")}</time>
                </div>
                {row.detail && <p className="text-xs text-foreground-tertiary">{row.detail}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import type { getBroadcastHistory } from "../queries";

type History = Awaited<ReturnType<typeof getBroadcastHistory>>;

export function BroadcastHistory({ broadcasts }: { broadcasts: History }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface p-5">
      <h2 className="font-semibold text-foreground">Past broadcasts</h2>
      {broadcasts.length === 0 ? (
        <p className="text-sm text-foreground-tertiary">Nothing sent yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-surface-border">
          {broadcasts.map((broadcast) => (
            <li key={broadcast.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 break-words text-sm font-semibold text-foreground">
                  {broadcast.title}
                </p>
                <time className="shrink-0 text-xs text-foreground-muted">
                  {broadcast.sentAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </time>
              </div>
              <p className="text-sm text-foreground-secondary">{broadcast.body}</p>
              <p className="text-xs text-foreground-tertiary">
                To {broadcast.clanNames.join(", ")} — {broadcast.recipientCount}{" "}
                {broadcast.recipientCount === 1 ? "person" : "people"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

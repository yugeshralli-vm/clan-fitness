import Link from "next/link";
import { Avatar } from "@/components/shared/Avatar";
import { getFeedbackThreadsForAdmin } from "../queries";

export async function FeedbackThreadsList() {
  const threads = await getFeedbackThreadsForAdmin();

  if (threads.length === 0) {
    return <p className="text-sm text-foreground-tertiary">No feedback messages yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {threads.map((thread) => (
        <li key={thread.userId}>
          <Link
            href={`/admin/feedback/${thread.userId}`}
            className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface p-3 hover:border-accent"
          >
            <Avatar src={thread.userAvatarUrl} name={thread.userName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{thread.userName}</p>
              <p className="truncate text-xs text-foreground-tertiary">{thread.lastMessage}</p>
            </div>
            <time className="shrink-0 text-xs text-foreground-muted">
              {thread.lastMessageAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}

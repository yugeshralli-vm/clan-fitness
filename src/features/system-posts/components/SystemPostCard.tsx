"use client";

import { Avatar } from "@/components/shared/Avatar";
import { CommentSheet } from "@/features/comments/components/CommentSheet";
import type { ClanMemberOption } from "@/features/comments/components/CommentThread";
import type { CommentWithUser } from "@/features/comments/queries";
import { ReactionBar } from "@/features/reactions/components/ReactionBar";
import type { ReactionSummary } from "@/features/reactions/types";
import type { SystemPostForFeed } from "../queries";

const MEDALS = ["🥇", "🥈", "🥉"];

function formatWeekRange(weekStart: Date, weekEnd: Date) {
  // weekEnd is the exclusive boundary (the *next* week's start) — display the last real day of
  // the window, not weekEnd itself.
  const lastDay = new Date(weekEnd.getTime() - 24 * 60 * 60 * 1000);
  const format = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${format(weekStart)} – ${format(lastDay)}`;
}

export function SystemPostCard({
  post,
  clanId,
  currentUserId,
  clanMembers,
  reactionSummary,
  onReactionChange,
  comments,
  onCommentsChange,
}: {
  post: SystemPostForFeed;
  clanId: string;
  currentUserId?: string | null;
  clanMembers?: ClanMemberOption[];
  reactionSummary?: ReactionSummary;
  onReactionChange: (next: ReactionSummary) => void;
  comments: CommentWithUser[];
  onCommentsChange: (next: CommentWithUser[]) => void;
}) {
  const maxScore = Math.max(1, ...post.topThree.map((entry) => entry.score));

  return (
    <div className="flex items-start gap-3 rounded-lg border border-accent/20 bg-gradient-to-b from-accent/5 to-surface p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
        C
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">Clan Fitness</span>
          <time className="shrink-0 text-xs text-foreground-muted" dateTime={post.createdAt.toISOString()}>
            {post.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </time>
        </div>

        {post.topThree.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="w-fit rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                🏆 This week&apos;s top 3
              </span>
              <span className="text-xs text-foreground-muted">{formatWeekRange(post.weekStart, post.weekEnd)}</span>
            </div>
            {post.topThree.map((entry, i) => (
              <div key={entry.userId} className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-center text-sm" aria-hidden>
                  {MEDALS[i]}
                </span>
                <Avatar src={entry.avatarUrl} name={entry.name} size={20} />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{entry.name}</span>
                <span className="h-1 w-11 shrink-0 overflow-hidden rounded-full bg-surface-border">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${Math.round((entry.score / maxScore) * 100)}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-xs text-foreground-tertiary">
                  {Math.round(entry.score)}
                </span>
              </div>
            ))}
          </div>
        )}

        {post.wallOfShame.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-dashed border-surface-border pt-2">
            <span className="w-fit rounded-full bg-ember/15 px-2 py-0.5 text-xs font-semibold text-ember">
              🙈 Wall of shame
            </span>
            <div className="flex flex-wrap gap-1.5">
              {post.wallOfShame.map((entry) => (
                <span
                  key={entry.userId}
                  className="flex items-center gap-1.5 rounded-full border border-surface-border bg-background px-2 py-1 text-xs text-foreground-secondary"
                >
                  <Avatar src={entry.avatarUrl} name={entry.name} size={17} />
                  {entry.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <ReactionBar
            target={{ kind: "systemPost", id: post.id }}
            clanId={clanId}
            summary={reactionSummary}
            onSummaryChange={onReactionChange}
          />
          <CommentSheet
            target={{ kind: "systemPost", id: post.id }}
            clanId={clanId}
            comments={comments}
            currentUserId={currentUserId}
            clanMembers={clanMembers}
            onCommentsChange={onCommentsChange}
          />
        </div>
      </div>
    </div>
  );
}

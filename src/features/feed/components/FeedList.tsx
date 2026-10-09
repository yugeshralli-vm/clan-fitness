"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/shared/Avatar";
import { LevelBadge } from "@/components/shared/LevelBadge";
import { PhotoCarousel } from "@/components/ui/photo-carousel";
import type { FeedRow } from "@/features/check-ins";
import { getFoodPhotoUrls } from "@/features/check-ins/types";
import type { FoodCheckInValue, ThoughtCheckInValue } from "@/features/check-ins/types";
import { CommentSheet } from "@/features/comments/components/CommentSheet";
import type { ClanMemberOption } from "@/features/comments/components/CommentThread";
import type { CommentWithUser } from "@/features/comments/queries";
import { levelForPoints, type LevelCurveConfig } from "@/features/clan-contracts/level";
import { ReactionBar } from "@/features/reactions/components/ReactionBar";
import { useRealtime } from "@/features/realtime";
import type { ReactionSummary } from "@/features/reactions/types";
import { toast } from "@/components/ui/toast";
// Direct path, not the "@/features/system-posts" barrel — that barrel also exports server-only
// queries (getSystemPostsForClan/generateWeeklyRecap), which would bundle the DB driver into the
// client if imported from here (see the src/features/*/queries.ts "server-only" guard).
import { SystemPostCard } from "@/features/system-posts/components/SystemPostCard";
import type { SystemPostForFeed } from "@/features/system-posts";
import { loadFeedHead, loadMoreFeed } from "../actions";
import {
  dedupeEntriesForDisplay,
  describeCheckIn,
  formatDayLabel,
  getCheckInIcon,
  groupByDay,
  groupByUserAndDay,
  mergeFeedCards,
} from "../group";

// Only needed after a photo tap — code-split so it's not part of the feed's initial bundle.
const ImageLightbox = dynamic(() =>
  import("@/components/ui/image-lightbox").then((m) => m.ImageLightbox),
);

export function FeedList({
  clanId,
  currentUserId,
  viewerTimezone,
  clanMembers,
  initialRows,
  initialSystemPosts,
  initialReactions,
  initialComments,
  initialHasMore,
  highlightCheckInId,
  levelCurveConfig,
}: {
  clanId: string;
  currentUserId?: string | null;
  viewerTimezone: string | null;
  clanMembers?: ClanMemberOption[];
  initialRows: FeedRow[];
  initialSystemPosts: SystemPostForFeed[];
  initialReactions: Record<string, ReactionSummary>;
  initialComments: Record<string, CommentWithUser[]>;
  initialHasMore: boolean;
  levelCurveConfig: LevelCurveConfig;
  highlightCheckInId?: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [systemPosts, setSystemPosts] = useState(initialSystemPosts);
  const [reactions, setReactions] = useState(initialReactions);
  const [comments, setComments] = useState(initialComments);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [openGallery, setOpenGallery] = useState<{ photos: string[]; index: number } | null>(null);
  const [highlighted, setHighlighted] = useState(!!highlightCheckInId);

  // Scrolls to and briefly highlights the card a notification linked to. Runs once on mount —
  // ClanFeed already anchors initialRows so the target is present immediately, no need to react
  // to later "load more" pages.
  useEffect(() => {
    if (!highlightCheckInId) return;
    const el = document.getElementById(`feed-card-${highlightCheckInId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = setTimeout(() => setHighlighted(false), 2000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  });

  // New check-ins, edits, comments and reactions from clanmates show up without a pull-to-refresh.
  // No fallback poll — without the socket the feed refreshes on visit, as before.
  useRealtime({
    events: ["feed_post", "feed_engagement"],
    clanId,
    onChange: async () => {
      let head;
      try {
        head = await loadFeedHead(clanId, viewerTimezone);
      } catch {
        return; // Background refresh — the next event or visit will catch up.
      }
      // Replace the latest page, but keep any older "load more" pages the viewer already pulled in.
      const headIds = new Set(head.rows.map((row) => row.checkIn.id));
      const oldestHeadAt = head.rows[head.rows.length - 1]?.checkIn.createdAt;
      const olderRows =
        head.hasMore && oldestHeadAt
          ? rowsRef.current.filter((row) => !headIds.has(row.checkIn.id) && row.checkIn.createdAt < oldestHeadAt)
          : [];
      setRows([...head.rows, ...olderRows]);
      if (olderRows.length === 0) setHasMore(head.hasMore);
      setSystemPosts(head.systemPosts);
      setReactions((prev) => ({ ...prev, ...head.reactions }));
      setComments((prev) => ({ ...prev, ...head.comments }));
    },
  });

  async function handleLoadMore() {
    const cursor = rows[rows.length - 1]?.checkIn.createdAt;
    if (!cursor) return;

    setLoading(true);
    try {
      const page = await loadMoreFeed(clanId, cursor.toISOString(), viewerTimezone);
      setRows((prev) => [...prev, ...page.rows]);
      setReactions((prev) => ({ ...prev, ...page.reactions }));
      setComments((prev) => ({ ...prev, ...page.comments }));
      setHasMore(page.hasMore);
    } catch {
      toast.error("Couldn't load more — try again.");
    } finally {
      setLoading(false);
    }
  }

  // System posts aren't paginated (a clan's whole history is fetched at once — see
  // getSystemPostsForClan); they're only state so a realtime refresh can add a new weekly recap.
  const sections = groupByDay(mergeFeedCards(groupByUserAndDay(rows, viewerTimezone), systemPosts, viewerTimezone));

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section.day} className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
            {formatDayLabel(section.day, viewerTimezone)}
          </h3>
          <ul className="flex flex-col gap-3">
            {section.cards.map((card) => {
              if (card.kind === "systemPost") {
                const postId = card.post.id;
                return (
                  <li key={postId}>
                    <SystemPostCard
                      post={card.post}
                      clanId={clanId}
                      currentUserId={currentUserId}
                      clanMembers={clanMembers}
                      reactionSummary={reactions[postId]}
                      onReactionChange={(summary) => setReactions((prev) => ({ ...prev, [postId]: summary }))}
                      comments={comments[postId] ?? []}
                      onCommentsChange={(next) => setComments((prev) => ({ ...prev, [postId]: next }))}
                    />
                  </li>
                );
              }

              const group = card;
              // The oldest entry, not the newest (group.entries[0]) — it's the only one of the
              // group guaranteed to stay the group's identity for the rest of the day. Keying on
              // the newest meant adding a new check-in type later that day silently orphaned any
              // reactions/comments already made against the day's card.
              const cardId = group.entries[group.entries.length - 1].id;
              const isHighlighted = highlighted && cardId === highlightCheckInId;
              // Rendered as a title above the rest of the card, not as just another line in the
              // entries loop below — pulled out here and excluded from that loop.
              const displayEntries = dedupeEntriesForDisplay(group.entries);
              const thoughtEntry = displayEntries.find((checkIn) => checkIn.type === "thought");
              const otherEntries = displayEntries.filter((checkIn) => checkIn.type !== "thought");
              return (
                <li
                  key={group.user.id}
                  id={`feed-card-${cardId}`}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors duration-1000 ${
                    isHighlighted ? "border-accent bg-accent/10" : "border-surface-border bg-surface"
                  }`}
                >
                  <Link href={`/members/${group.user.id}`} className="shrink-0">
                    <Avatar src={group.user.avatarUrl} name={group.user.name} />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Link
                          href={`/members/${group.user.id}`}
                          className="min-w-0 truncate text-sm font-semibold text-foreground"
                        >
                          {group.user.name}
                        </Link>
                        <LevelBadge level={levelForPoints(group.user.totalPoints, levelCurveConfig)} />
                      </div>
                      <time
                        className="shrink-0 text-xs text-foreground-muted"
                        dateTime={group.latestAt.toISOString()}
                      >
                        {group.latestAt.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    {thoughtEntry && (
                      <p className="text-base font-semibold text-foreground">
                        {(thoughtEntry.value as ThoughtCheckInValue).text}
                      </p>
                    )}
                    <div className="flex flex-col gap-1">
                      {otherEntries.map((checkIn) => {
                        const photoUrls =
                          checkIn.type === "food"
                            ? getFoodPhotoUrls(checkIn.value as FoodCheckInValue)
                            : [];
                        return (
                          <div key={checkIn.id} className="flex flex-col gap-2">
                            <p className="flex items-center gap-1.5 text-sm text-foreground-secondary">
                              <span aria-hidden>{getCheckInIcon(checkIn.type, checkIn.value)}</span>
                              {describeCheckIn(checkIn.type, checkIn.value, checkIn.id)}
                            </p>
                            <PhotoCarousel
                              photos={photoUrls}
                              onPhotoClick={(index) => setOpenGallery({ photos: photoUrls, index })}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <ReactionBar
                        target={{ kind: "checkIn", id: cardId }}
                        clanId={clanId}
                        summary={reactions[cardId]}
                        onSummaryChange={(summary) =>
                          setReactions((prev) => ({ ...prev, [cardId]: summary }))
                        }
                      />
                      <CommentSheet
                        target={{ kind: "checkIn", id: cardId }}
                        clanId={clanId}
                        comments={comments[cardId] ?? []}
                        currentUserId={currentUserId}
                        clanMembers={clanMembers}
                        onCommentsChange={(next) => setComments((prev) => ({ ...prev, [cardId]: next }))}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {hasMore && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={loading}
          className="min-h-11 self-center px-4 text-sm font-semibold text-accent disabled:opacity-40"
        >
          {loading ? "Loading..." : "Load more"}
        </button>
      )}

      <ImageLightbox
        images={openGallery?.photos ?? []}
        initialIndex={openGallery?.index ?? 0}
        onClose={() => setOpenGallery(null)}
      />
    </div>
  );
}

"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/shared/Avatar";
import type { FeedRow } from "@/features/check-ins";
import type { FoodCheckInValue } from "@/features/check-ins/types";
import { CommentSheet } from "@/features/comments/components/CommentSheet";
import type { ClanMemberOption } from "@/features/comments/components/CommentThread";
import type { CommentWithUser } from "@/features/comments/queries";
import { ReactionBar } from "@/features/reactions/components/ReactionBar";
import type { ReactionSummary } from "@/features/reactions/types";
import { loadMoreFeed } from "../actions";
import { describeCheckIn, formatDayLabel, groupByDay, groupByUserAndDay, TYPE_ICON } from "../group";

// Only needed after a photo tap — code-split so it's not part of the feed's initial bundle.
const ImageLightbox = dynamic(() =>
  import("@/components/ui/image-lightbox").then((m) => m.ImageLightbox),
);

export function FeedList({
  clanId,
  currentUserId,
  clanMembers,
  initialRows,
  initialReactions,
  initialComments,
  initialHasMore,
  highlightCheckInId,
}: {
  clanId: string;
  currentUserId?: string | null;
  clanMembers?: ClanMemberOption[];
  initialRows: FeedRow[];
  initialReactions: Record<string, ReactionSummary>;
  initialComments: Record<string, CommentWithUser[]>;
  initialHasMore: boolean;
  highlightCheckInId?: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [reactions, setReactions] = useState(initialReactions);
  const [comments, setComments] = useState(initialComments);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [openImage, setOpenImage] = useState<string | null>(null);
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

  async function handleLoadMore() {
    const cursor = rows[rows.length - 1]?.checkIn.createdAt;
    if (!cursor) return;

    setLoading(true);
    try {
      const page = await loadMoreFeed(clanId, cursor.toISOString());
      setRows((prev) => [...prev, ...page.rows]);
      setReactions((prev) => ({ ...prev, ...page.reactions }));
      setComments((prev) => ({ ...prev, ...page.comments }));
      setHasMore(page.hasMore);
    } finally {
      setLoading(false);
    }
  }

  const sections = groupByDay(groupByUserAndDay(rows));

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section.day} className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
            {formatDayLabel(section.day)}
          </h3>
          <ul className="flex flex-col gap-3">
            {section.cards.map((group) => {
              const cardId = group.entries[0].id;
              const isHighlighted = highlighted && cardId === highlightCheckInId;
              return (
                <li
                  key={group.user.id}
                  id={`feed-card-${cardId}`}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors duration-1000 ${
                    isHighlighted ? "border-accent bg-accent/10" : "border-surface-border bg-surface"
                  }`}
                >
                  <Avatar src={group.user.avatarUrl} name={group.user.name} />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                        {group.user.name}
                      </span>
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
                    <div className="flex flex-col gap-1">
                      {group.entries.map((checkIn) => {
                        const photoUrl =
                          checkIn.type === "food"
                            ? (checkIn.value as FoodCheckInValue).photoUrl
                            : undefined;
                        return (
                          <div key={checkIn.id} className="flex flex-col gap-2">
                            <p className="flex items-center gap-1.5 text-sm text-foreground-secondary">
                              <span aria-hidden>{TYPE_ICON[checkIn.type] ?? "✅"}</span>
                              {describeCheckIn(checkIn.type, checkIn.value)}
                            </p>
                            {photoUrl && (
                              <button
                                type="button"
                                onClick={() => setOpenImage(photoUrl)}
                                aria-label="View photo full-screen"
                                className="block w-full max-w-xs cursor-zoom-in"
                              >
                                <Image
                                  src={photoUrl}
                                  alt=""
                                  width={320}
                                  height={240}
                                  className="max-h-60 w-full max-w-xs rounded-lg border border-surface-border object-cover"
                                />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <ReactionBar
                        checkInId={cardId}
                        summary={reactions[cardId]}
                        onSummaryChange={(summary) =>
                          setReactions((prev) => ({ ...prev, [cardId]: summary }))
                        }
                      />
                      <CommentSheet
                        checkInId={cardId}
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

      <ImageLightbox src={openImage} onClose={() => setOpenImage(null)} />
    </div>
  );
}

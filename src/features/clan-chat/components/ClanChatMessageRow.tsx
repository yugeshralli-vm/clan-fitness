"use client";

import { Reply } from "lucide-react";
import { motion, useMotionValue, useTransform } from "motion/react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/shared/Avatar";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { toast } from "@/components/ui/toast";
import { toggleClanMessageReaction } from "@/features/reactions/actions";
import { CHAT_REACTION_EMOJIS } from "@/features/reactions/types";
import type { ReactionSummary } from "@/features/reactions/types";
import { triggerHaptic } from "@/lib/haptics";
import { parseCommentSegments } from "@/lib/mentions";
import type { ClanMessageRow } from "../queries";

const SWIPE_TRIGGER_PX = 56;
const SWIPE_MAX_PX = 72;
const LONG_PRESS_MS = 450;

/**
 * Extracted from ClanChatThread's list so each row can own its own drag motion value — hooks
 * can't run inside the parent's .map() loop. dragDirectionLock lets a vertical swipe still scroll
 * the page normally; only a deliberate horizontal drag reveals/triggers the reply action.
 */
export function ClanChatMessageRow({
  message,
  mine,
  currentUserId,
  onReply,
  onReact,
}: {
  message: ClanMessageRow;
  mine: boolean;
  currentUserId: string;
  onReply: (message: ClanMessageRow) => void;
  onReact: (messageId: string, summary: ReactionSummary) => void;
}) {
  const x = useMotionValue(0);
  const replyIconOpacity = useTransform(x, [0, SWIPE_TRIGGER_PX], [0, 1]);
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reactorSheetOpen, setReactorSheetOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Long-press fires on pointer-down-and-hold, but the browser still sends a click once the
  // finger/button lifts (no movement happened, so the browser doesn't suppress it) — this flag
  // tells that trailing click to skip opening the reactor sheet, since the hold already opened
  // the picker.
  const longPressFired = useRef(false);

  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  function handlePointerDown() {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      triggerHaptic();
      setPickerOpen(true);
    }, LONG_PRESS_MS);
  }

  function react(emoji: string) {
    setPickerOpen(false);
    startTransition(async () => {
      const result = await toggleClanMessageReaction(message.id, message.clanId, emoji);
      if ("summary" in result) {
        onReact(message.id, result.summary);
      } else {
        toast.error(result.error);
      }
    });
  }

  const presentEmojis = Object.entries(message.reactionsSummary).filter(([, entry]) => entry.users.length > 0);

  function openReactorSheet() {
    if (longPressFired.current) return;
    if (presentEmojis.length === 0) return;
    setReactorSheetOpen(true);
  }

  // Removing your own reaction from the sheet (the only way to remove one — pills/tapping the
  // bubble now just open this sheet) can empty it out entirely; derive the open state from the
  // data itself so an empty sheet never lingers, rather than syncing it via an effect.
  const showReactorSheet = reactorSheetOpen && presentEmojis.length > 0;

  return (
    <div className="relative min-w-0">
      <motion.div
        style={{ opacity: replyIconOpacity }}
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-foreground-tertiary"
      >
        <Reply size={18} />
      </motion.div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: SWIPE_MAX_PX }}
        dragElastic={0.3}
        dragMomentum={false}
        dragSnapToOrigin
        style={{ x }}
        onDragStart={cancelLongPress}
        onDragEnd={(_event, info) => {
          if (info.offset.x > SWIPE_TRIGGER_PX) {
            triggerHaptic();
            onReply(message);
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onContextMenu={(event) => event.preventDefault()}
        className={`flex touch-pan-y items-end gap-2 bg-background ${mine ? "flex-row-reverse" : ""}`}
      >
        {!mine && (
          <Link href={`/members/${message.userId}`} className="shrink-0">
            <Avatar src={message.authorAvatarUrl} name={message.authorName} size={28} />
          </Link>
        )}
        <div className={`flex min-w-0 max-w-[75%] flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
          {!mine && (
            <Link
              href={`/members/${message.userId}`}
              className="px-1 text-xs font-semibold text-foreground-tertiary"
            >
              {message.authorName}
            </Link>
          )}
          <div
            onClick={openReactorSheet}
            className={`min-w-0 rounded-lg px-3 py-2 text-sm ${
              presentEmojis.length > 0 ? "cursor-pointer" : ""
            } ${
              mine
                ? "bg-accent text-accent-foreground"
                : "border border-surface-border bg-surface text-foreground-secondary"
            }`}
          >
            {message.replyToMessageId && (
              // max-w-[60vw]: the author-name line below still uses `truncate` (white-space:
              // nowrap), whose full unwrapped width otherwise gets counted as this element's
              // max-content size — and that max-content then bubbles up through the ancestor flex
              // boxes above (which size via fit-content, not stretch, so they don't stop it),
              // forcing the *entire* bubble to render at that width instead of wrapping. A
              // viewport-relative cap bounds it independently of any ancestor's flex sizing,
              // breaking that chain outright. The quoted body itself uses line-clamp instead of
              // truncate (wraps normally, then clips after 2 lines), so it doesn't have the same
              // nowrap-driven sizing risk — but the cap is shared/harmless either way.
              <div
                className={`mb-1 max-w-[60vw] rounded-md border-l-2 px-2 py-1 text-xs ${
                  mine ? "border-accent-foreground/40 bg-black/10" : "border-accent/60 bg-foreground/5"
                }`}
              >
                <p className="truncate font-semibold">{message.replyToAuthorName ?? "Original message"}</p>
                <p className="line-clamp-2 opacity-80">{message.replyToBody}</p>
              </div>
            )}
            <p className="whitespace-pre-wrap break-words">
              {parseCommentSegments(message.body).map((segment, i) =>
                segment.type === "mention" ? (
                  <span key={i} className={`font-semibold ${mine ? "" : "text-accent"}`}>
                    @{segment.name}
                  </span>
                ) : (
                  <span key={i}>{segment.value}</span>
                ),
              )}
            </p>
          </div>

          {presentEmojis.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {presentEmojis.map(([emoji, entry]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={openReactorSheet}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                    entry.reactedByMe
                      ? "border-accent text-accent"
                      : "border-surface-border text-foreground-tertiary"
                  }`}
                >
                  <span aria-hidden>{emoji}</span>
                  {entry.users.length}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {pickerOpen && (
        <>
          <div onClick={() => setPickerOpen(false)} aria-hidden className="fixed inset-0 z-20" />
          <div
            className={`absolute bottom-full z-20 mb-1 flex max-w-[90vw] flex-wrap gap-1 rounded-full border border-surface-border bg-surface p-1.5 shadow-lg ${
              mine ? "right-0" : "left-0"
            }`}
          >
            {CHAT_REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => react(emoji)}
                disabled={pending}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg hover:bg-background disabled:opacity-60"
              >
                <span aria-hidden>{emoji}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <BottomSheet open={showReactorSheet} onClose={() => setReactorSheetOpen(false)} title="Reactions">
        <div className="flex flex-col gap-4">
          {presentEmojis.map(([emoji, entry]) => (
            <div key={emoji}>
              <p className="mb-2 text-xs font-semibold text-foreground-tertiary">
                <span aria-hidden>{emoji}</span> {entry.users.length}
              </p>
              <ul className="flex flex-col divide-y divide-surface-border">
                {entry.users.map((user) =>
                  user.id === currentUserId ? (
                    <li key={user.id} className="py-3 first:pt-0 last:pb-0">
                      <button
                        type="button"
                        onClick={() => react(emoji)}
                        disabled={pending}
                        className="flex w-full items-center gap-3 text-left disabled:opacity-60"
                      >
                        <Avatar src={user.avatarUrl} name={user.name} />
                        <span className="flex flex-col">
                          <span className="text-sm text-foreground">You</span>
                          <span className="text-xs text-foreground-tertiary">Tap to remove</span>
                        </span>
                      </button>
                    </li>
                  ) : (
                    <li key={user.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <Link href={`/members/${user.id}`} className="flex items-center gap-3">
                        <Avatar src={user.avatarUrl} name={user.name} />
                        <span className="text-sm text-foreground">{user.name}</span>
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

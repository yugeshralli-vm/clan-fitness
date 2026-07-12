"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/shared/Avatar";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { toggleReaction, toggleSystemPostReaction } from "../actions";
import { REACTION_EMOJIS } from "../types";
import type { ReactionSummary } from "../types";

export type ReactionTarget = { kind: "checkIn"; id: string } | { kind: "systemPost"; id: string };

const LONG_PRESS_MS = 450;

export function ReactionBar({
  target,
  clanId,
  summary,
  onSummaryChange,
}: {
  target: ReactionTarget;
  clanId: string;
  summary?: ReactionSummary;
  onSummaryChange: (next: ReactionSummary) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [detailEmoji, setDetailEmoji] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Long-press fires on pointer-down-and-hold, but the browser still sends a click when the
  // finger/button lifts — this flag tells that click to skip toggling, since the hold already
  // did its thing (opened the sheet).
  const longPressFired = useRef(false);

  function handlePointerDown(emoji: string) {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setDetailEmoji(emoji);
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  function handleClick(emoji: string) {
    if (longPressFired.current) return;
    startTransition(async () => {
      const result =
        target.kind === "checkIn"
          ? await toggleReaction(target.id, clanId, emoji)
          : await toggleSystemPostReaction(target.id, clanId, emoji);
      if ("summary" in result) onSummaryChange(result.summary);
    });
  }

  const reactors = detailEmoji ? (summary?.[detailEmoji]?.users ?? []) : [];

  return (
    <>
      <div className="flex gap-1.5">
        {REACTION_EMOJIS.map((emoji) => {
          const entry = summary?.[emoji];
          const count = entry?.users.length ?? 0;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => handleClick(emoji)}
              onPointerDown={() => handlePointerDown(emoji)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onContextMenu={(event) => event.preventDefault()}
              disabled={pending}
              className={`flex min-h-9 items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-60 ${
                entry?.reactedByMe
                  ? "border-accent text-accent"
                  : "border-surface-border text-foreground-tertiary"
              }`}
            >
              <span aria-hidden>{emoji}</span>
              {count ? count : null}
            </button>
          );
        })}
      </div>

      <BottomSheet
        open={detailEmoji !== null}
        onClose={() => setDetailEmoji(null)}
        title={detailEmoji ? `Reacted ${detailEmoji}` : "Reactions"}
      >
        <ul className="flex flex-col divide-y divide-surface-border">
          {reactors.map((user) => (
            <li key={user.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Avatar src={user.avatarUrl} name={user.name} />
              <span className="text-sm text-foreground">{user.name}</span>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}

"use client";

import { Reply } from "lucide-react";
import { motion, useMotionValue, useTransform } from "motion/react";
import Link from "next/link";
import { Avatar } from "@/components/shared/Avatar";
import { triggerHaptic } from "@/lib/haptics";
import { parseCommentSegments } from "@/lib/mentions";
import type { ClanMessageRow } from "../queries";

const SWIPE_TRIGGER_PX = 56;
const SWIPE_MAX_PX = 72;

/**
 * Extracted from ClanChatThread's list so each row can own its own drag motion value — hooks
 * can't run inside the parent's .map() loop. dragDirectionLock lets a vertical swipe still scroll
 * the page normally; only a deliberate horizontal drag reveals/triggers the reply action.
 */
export function ClanChatMessageRow({
  message,
  mine,
  onReply,
}: {
  message: ClanMessageRow;
  mine: boolean;
  onReply: (message: ClanMessageRow) => void;
}) {
  const x = useMotionValue(0);
  const replyIconOpacity = useTransform(x, [0, SWIPE_TRIGGER_PX], [0, 1]);

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
        onDragEnd={(_event, info) => {
          if (info.offset.x > SWIPE_TRIGGER_PX) {
            triggerHaptic();
            onReply(message);
          }
        }}
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
            className={`min-w-0 rounded-lg px-3 py-2 text-sm ${
              mine
                ? "bg-accent text-accent-foreground"
                : "border border-surface-border bg-surface text-foreground-secondary"
            }`}
          >
            {message.replyToMessageId && (
              <div
                className={`mb-1 rounded-md border-l-2 px-2 py-1 text-xs ${
                  mine ? "border-accent-foreground/40 bg-black/10" : "border-accent/60 bg-foreground/5"
                }`}
              >
                <p className="font-semibold">{message.replyToAuthorName ?? "Original message"}</p>
                <p className="truncate opacity-80">{message.replyToBody}</p>
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
        </div>
      </motion.div>
    </div>
  );
}

"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CommentThread, type ClanMemberOption, type CommentTarget } from "./CommentThread";
import type { CommentWithUser } from "../queries";

export function CommentSheet({
  target,
  clanId,
  comments,
  currentUserId,
  clanMembers,
  onCommentsChange,
}: {
  target: CommentTarget;
  clanId: string;
  comments: CommentWithUser[];
  currentUserId?: string | null;
  clanMembers?: ClanMemberOption[];
  onCommentsChange: (next: CommentWithUser[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={comments.length > 0 ? `${comments.length} comments` : "Add a comment"}
        className="flex min-h-9 items-center gap-1.5 rounded-full border border-surface-border px-3 py-1.5 text-xs text-foreground-tertiary transition-colors hover:text-foreground"
      >
        <MessageCircle size={16} aria-hidden />
        {comments.length > 0 ? comments.length : null}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Comments">
        <CommentThread
          target={target}
          clanId={clanId}
          comments={comments}
          currentUserId={currentUserId}
          clanMembers={clanMembers}
          onCommentsChange={onCommentsChange}
        />
      </BottomSheet>
    </>
  );
}

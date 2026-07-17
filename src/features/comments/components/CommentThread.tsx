"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/shared/Avatar";
import { MentionInput, type MentionInputHandle } from "@/components/shared/MentionInput";
import { parseCommentSegments } from "@/lib/mentions";
import { addComment, addSystemPostComment, deleteComment } from "../actions";
import type { CommentWithUser } from "../queries";
import { COMMENT_MAX_LENGTH } from "../types";

export type ClanMemberOption = { id: string; name: string; avatarUrl: string | null };
export type CommentTarget = { kind: "checkIn"; id: string } | { kind: "systemPost"; id: string };

export function CommentThread({
  target,
  clanId,
  comments,
  currentUserId,
  clanMembers = [],
  onCommentsChange,
}: {
  target: CommentTarget;
  clanId: string;
  comments: CommentWithUser[];
  currentUserId?: string | null;
  clanMembers?: ClanMemberOption[];
  onCommentsChange: (next: CommentWithUser[]) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const mentionInputRef = useRef<MentionInputHandle>(null);

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    const rawValue = mentionInputRef.current?.getMarkupValue() ?? text;

    startTransition(async () => {
      const result =
        target.kind === "checkIn"
          ? await addComment(target.id, clanId, rawValue)
          : await addSystemPostComment(target.id, clanId, rawValue);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(undefined);
      setText("");
      mentionInputRef.current?.reset();
      onCommentsChange([...comments, result.comment]);
    });
  }

  function handleDelete(commentId: string) {
    startTransition(async () => {
      const result = await deleteComment(commentId);
      if (result.error) {
        setError(result.error);
        return;
      }
      onCommentsChange(comments.filter((comment) => comment.id !== commentId));
    });
  }

  return (
    // min-h-60 + justify-end: the mention dropdown below is absolutely positioned above the
    // input (bottom-full), so it needs real space above the input to render into. With zero (or
    // few) comments there's nothing else in this column to provide that space, and the dropdown
    // was getting clipped by the sheet's own top edge. justify-end keeps this reserved space
    // above the content instead of below it; once real comments exceed this min-height, both
    // become no-ops and the layout behaves exactly as before.
    <div className="flex min-h-60 flex-col justify-end gap-2">
      {comments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {comments.map((comment) => (
            <li key={comment.id} className="flex min-w-0 items-start gap-2">
              <Link href={`/members/${comment.user.id}`} className="shrink-0">
                <Avatar src={comment.user.avatarUrl} name={comment.user.name} size={24} />
              </Link>
              <p className="min-w-0 flex-1 text-sm text-foreground-secondary">
                <Link href={`/members/${comment.user.id}`} className="font-semibold text-foreground">
                  {comment.user.name}
                </Link>{" "}
                {parseCommentSegments(comment.text).map((segment, i) =>
                  segment.type === "mention" ? (
                    <span key={i} className="font-semibold text-accent">
                      @{segment.name}
                    </span>
                  ) : (
                    <span key={i}>{segment.value}</span>
                  ),
                )}
              </p>
              {comment.userId === currentUserId && (
                <button
                  type="button"
                  onClick={() => handleDelete(comment.id)}
                  disabled={pending}
                  aria-label="Delete comment"
                  className="-m-2 shrink-0 p-2 text-xs text-foreground-muted hover:text-danger"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <MentionInput
          ref={mentionInputRef}
          value={text}
          onChange={setText}
          members={clanMembers}
          excludeUserId={currentUserId}
          maxLength={COMMENT_MAX_LENGTH}
          placeholder="Add a comment... (@ to mention)"
          className="w-full min-w-0 rounded-lg border border-surface-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-foreground-muted sm:text-sm"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="shrink-0 text-sm font-semibold text-accent disabled:opacity-40"
        >
          Post
        </button>
      </form>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

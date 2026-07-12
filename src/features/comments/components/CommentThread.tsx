"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/shared/Avatar";
import { addComment, addSystemPostComment, deleteComment } from "../actions";
import { buildMentionMarkup, parseCommentSegments } from "../mentions";
import type { ResolvedMention } from "../mentions";
import type { CommentWithUser } from "../queries";
import { COMMENT_MAX_LENGTH } from "../types";

export type ClanMemberOption = { id: string; name: string; avatarUrl: string | null };
export type CommentTarget = { kind: "checkIn"; id: string } | { kind: "systemPost"; id: string };

const MENTION_TRIGGER = /(?:^|\s)@([^\s@]*)$/;
const MAX_MENTION_SUGGESTIONS = 5;

/**
 * Finds the single contiguous region where `newText` differs from `oldText` — always exactly one
 * such region for a native input's onChange, since a single keystroke/paste/cut can only edit one
 * spot. Used to shift or drop tracked mention ranges (see ResolvedMention) as the surrounding text
 * is edited, without re-deriving them from scratch on every keystroke.
 */
function diffRange(oldText: string, newText: string) {
  let prefixLen = 0;
  while (prefixLen < oldText.length && prefixLen < newText.length && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++;
  }
  let suffixLen = 0;
  const maxSuffix = Math.min(oldText.length, newText.length) - prefixLen;
  while (
    suffixLen < maxSuffix &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }
  const oldEditEnd = oldText.length - suffixLen;
  const newEditEnd = newText.length - suffixLen;
  return { editStart: prefixLen, oldEditEnd, delta: newEditEnd - oldEditEnd };
}

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
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  // Resolved mentions currently active in `text`, by character range — `text` itself is always
  // the clean "@Name" display form the user sees and edits, never the `@[Name](id)` markup, so
  // the id is reconstructed from this only at submit time (see buildMentionMarkup). Doesn't need
  // to be state: nothing renders differently based on it.
  const mentionsRef = useRef<ResolvedMention[]>([]);

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.toLowerCase();
    return clanMembers
      .filter((member) => member.id !== currentUserId && member.name.toLowerCase().includes(query))
      .slice(0, MAX_MENTION_SUGGESTIONS);
  }, [mentionQuery, clanMembers, currentUserId]);

  function handleTextChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    const { editStart, oldEditEnd, delta } = diffRange(text, value);

    mentionsRef.current = mentionsRef.current.flatMap((mention) => {
      if (mention.end <= editStart) return [mention]; // entirely before the edit — unaffected
      if (oldEditEnd <= mention.start) {
        return [{ ...mention, start: mention.start + delta, end: mention.end + delta }]; // shift
      }
      return []; // edit overlapped this mention's text — it's no longer a mention
    });

    setText(value);

    const caret = event.target.selectionStart ?? value.length;
    const match = MENTION_TRIGGER.exec(value.slice(0, caret));
    setMentionQuery(match ? match[1] : null);
    setHighlightedIndex(0);
  }

  function selectMention(member: ClanMemberOption) {
    const input = inputRef.current;
    const caret = input?.selectionStart ?? text.length;
    const match = MENTION_TRIGGER.exec(text.slice(0, caret));
    if (!match) return;

    const mentionStart = caret - match[1].length - 1;
    const mentionLabel = `@${member.name}`;
    const mentionText = `${mentionLabel} `;
    const next = text.slice(0, mentionStart) + mentionText + text.slice(caret);
    const delta = mentionText.length - (caret - mentionStart);

    mentionsRef.current = [
      ...mentionsRef.current.map((mention) =>
        mention.start >= caret ? { ...mention, start: mention.start + delta, end: mention.end + delta } : mention,
      ),
      { id: member.id, name: member.name, start: mentionStart, end: mentionStart + mentionLabel.length },
    ];
    setText(next);
    setMentionQuery(null);

    requestAnimationFrame(() => {
      const cursor = mentionStart + mentionText.length;
      input?.setSelectionRange(cursor, cursor);
      input?.focus();
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (mentionMatches.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((i) => (i + 1) % mentionMatches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      selectMention(mentionMatches[highlightedIndex]);
    } else if (event.key === "Escape") {
      setMentionQuery(null);
    }
  }

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    const rawValue = buildMentionMarkup(text, mentionsRef.current);

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
      mentionsRef.current = [];
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
              <Avatar src={comment.user.avatarUrl} name={comment.user.name} size={24} />
              <p className="min-w-0 flex-1 text-sm text-foreground-secondary">
                <span className="font-semibold text-foreground">{comment.user.name}</span>{" "}
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
        <div className="relative min-w-0 flex-1">
          {mentionMatches.length > 0 && (
            <ul className="absolute bottom-full left-0 z-10 mb-1 w-56 max-w-[80vw] overflow-hidden rounded-lg border border-surface-border bg-surface shadow-lg">
              {mentionMatches.map((member, i) => (
                <li key={member.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectMention(member)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                      i === highlightedIndex ? "bg-background text-foreground" : "text-foreground-secondary"
                    }`}
                  >
                    <Avatar src={member.avatarUrl} name={member.name} size={20} />
                    {member.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={inputRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setMentionQuery(null)}
            maxLength={COMMENT_MAX_LENGTH}
            placeholder="Add a comment... (@ to mention)"
            className="w-full min-w-0 rounded-lg border border-surface-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-foreground-muted sm:text-sm"
          />
        </div>
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

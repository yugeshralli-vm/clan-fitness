"use client";

import { Users } from "lucide-react";
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { buildMentionMarkup, MENTION_EVERYONE_ID, type ResolvedMention } from "@/lib/mentions";
import { Avatar } from "./Avatar";

export type MentionMember = { id: string; name: string; avatarUrl: string | null };

const EVERYONE_OPTION: MentionMember = { id: MENTION_EVERYONE_ID, name: "everyone", avatarUrl: null };

export type MentionInputHandle = {
  /** Current text rewritten with `@[Name](id)` markup for any resolved mentions — read this at
   * submit time instead of the plain `value` the input shows. */
  getMarkupValue: () => string;
  /** Clears tracked mentions — call after a successful submit, alongside resetting `value` itself. */
  reset: () => void;
};

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

/** A single-line text input with "@ to mention" autocomplete — the caller owns the plain display
 * text (`value`/`onChange`, for the controlled input and clearing it on submit); this component
 * owns caret tracking and resolved-mention ranges internally, exposing the `@[Name](id)`-markup
 * form only on demand via the imperative handle, at submit time. */
export const MentionInput = forwardRef<
  MentionInputHandle,
  {
    value: string;
    onChange: (value: string) => void;
    members: MentionMember[];
    excludeUserId?: string | null;
    /** Offers "@everyone" as a mentionable option, on top of the real members — only makes sense
     * where a broadcast-to-everyone mention is meaningful (clan chat), so callers opt in. */
    allowEveryone?: boolean;
    placeholder?: string;
    maxLength?: number;
    className?: string;
  }
>(function MentionInput(
  { value, onChange, members, excludeUserId, allowEveryone, placeholder, maxLength, className },
  ref,
) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Resolved mentions currently active in `value`, by character range — `value` itself is always
  // the clean "@Name" display form the user sees and edits, never the `@[Name](id)` markup, so
  // the id is reconstructed from this only on demand (see getMarkupValue).
  const mentionsRef = useRef<ResolvedMention[]>([]);

  useImperativeHandle(
    ref,
    () => ({
      getMarkupValue: () => buildMentionMarkup(value, mentionsRef.current),
      reset: () => {
        mentionsRef.current = [];
      },
    }),
    [value],
  );

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.toLowerCase();
    const memberMatches = members.filter(
      (member) => member.id !== excludeUserId && member.name.toLowerCase().includes(query),
    );
    const matches =
      allowEveryone && EVERYONE_OPTION.name.includes(query) ? [EVERYONE_OPTION, ...memberMatches] : memberMatches;
    return matches.slice(0, MAX_MENTION_SUGGESTIONS);
  }, [mentionQuery, members, excludeUserId, allowEveryone]);

  function handleTextChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    const { editStart, oldEditEnd, delta } = diffRange(value, next);

    mentionsRef.current = mentionsRef.current.flatMap((mention) => {
      if (mention.end <= editStart) return [mention]; // entirely before the edit — unaffected
      if (oldEditEnd <= mention.start) {
        return [{ ...mention, start: mention.start + delta, end: mention.end + delta }]; // shift
      }
      return []; // edit overlapped this mention's text — it's no longer a mention
    });

    onChange(next);

    const caret = event.target.selectionStart ?? next.length;
    const match = MENTION_TRIGGER.exec(next.slice(0, caret));
    setMentionQuery(match ? match[1] : null);
    setHighlightedIndex(0);
  }

  function selectMention(member: MentionMember) {
    const input = inputRef.current;
    const caret = input?.selectionStart ?? value.length;
    const match = MENTION_TRIGGER.exec(value.slice(0, caret));
    if (!match) return;

    const mentionStart = caret - match[1].length - 1;
    const mentionLabel = `@${member.name}`;
    const mentionText = `${mentionLabel} `;
    const next = value.slice(0, mentionStart) + mentionText + value.slice(caret);
    const delta = mentionText.length - (caret - mentionStart);

    mentionsRef.current = [
      ...mentionsRef.current.map((mention) =>
        mention.start >= caret ? { ...mention, start: mention.start + delta, end: mention.end + delta } : mention,
      ),
      { id: member.id, name: member.name, start: mentionStart, end: mentionStart + mentionLabel.length },
    ];
    onChange(next);
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

  return (
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
                {member.id === MENTION_EVERYONE_ID ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Users size={12} />
                  </span>
                ) : (
                  <Avatar src={member.avatarUrl} name={member.name} size={20} />
                )}
                {member.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setMentionQuery(null)}
        maxLength={maxLength}
        placeholder={placeholder}
        className={
          className ??
          "w-full min-w-0 rounded-lg border border-surface-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:text-sm"
        }
      />
    </div>
  );
});

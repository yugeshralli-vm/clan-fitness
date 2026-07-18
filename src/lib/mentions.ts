/**
 * Mentions are stored inline as `@[Display Name](userId)`, chosen over plain `@name` matching
 * because member names can contain spaces and aren't unique — encoding the userId lets us
 * render and notify precisely without guessing where a mention ends.
 */
const MENTION_PATTERN = /@\[([^\]]+)\]\(([^)]+)\)/g;

/** Sentinel id for an `@everyone` mention — not a real user id, so it's naturally excluded
 * wherever mentioned ids are checked against real membership; callers that want to broadcast to
 * every member check for this id explicitly instead (see clan-chat's sendClanMessage). */
export const MENTION_EVERYONE_ID = "everyone";

export type CommentSegment = { type: "text"; value: string } | { type: "mention"; name: string; userId: string };

export function extractMentionedUserIds(text: string): string[] {
  return [...text.matchAll(MENTION_PATTERN)].map((match) => match[2]);
}

/** Renders mention markup as human-readable `@Name`, for notification bodies and any plain-text use. */
export function mentionsToPlainText(text: string): string {
  return text.replace(MENTION_PATTERN, "@$1");
}

/** Splits comment text into plain-text and mention segments for rich rendering. */
export function parseCommentSegments(text: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ type: "text", value: text.slice(lastIndex, index) });
    segments.push({ type: "mention", name: match[1], userId: match[2] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ type: "text", value: text.slice(lastIndex) });

  return segments;
}

export type ResolvedMention = { id: string; name: string; start: number; end: number };

/**
 * Inverse of the above: rebuilds `@[Name](id)` markup from clean display text (what the compose
 * input shows and edits — never the raw markup itself, so the user never sees a mention's id)
 * plus the ranges within it that are resolved mentions. `start`/`end` bound just the `@Name`
 * substring, so any text before/after (including the trailing space after a mention) is untouched.
 */
export function buildMentionMarkup(displayText: string, mentions: ResolvedMention[]): string {
  if (mentions.length === 0) return displayText;
  const sorted = [...mentions].sort((a, b) => a.start - b.start);
  let result = "";
  let cursor = 0;
  for (const mention of sorted) {
    result += displayText.slice(cursor, mention.start);
    result += `@[${mention.name}](${mention.id})`;
    cursor = mention.end;
  }
  result += displayText.slice(cursor);
  return result;
}

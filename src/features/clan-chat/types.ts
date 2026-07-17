export const CLAN_MESSAGE_MAX_LENGTH = 2000;

/**
 * Ceiling on the raw stored text (mention markup like `@[Name](userId)` is longer than what's
 * displayed). CLAN_MESSAGE_MAX_LENGTH is enforced against the rendered/plain-text length instead
 * — same split as COMMENT_MAX_LENGTH/COMMENT_MAX_RAW_LENGTH in src/features/comments/types.ts.
 */
export const CLAN_MESSAGE_MAX_RAW_LENGTH = 3000;

export type ClanChatEntry = { clanId: string; latestMessageAt: Date | null };

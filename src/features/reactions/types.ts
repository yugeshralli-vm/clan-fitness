export const REACTION_EMOJIS = ["🔥", "👏", "👎"] as const;

export type Reactor = { id: string; name: string; avatarUrl: string | null };

export type ReactionSummary = Record<string, { reactedByMe: boolean; users: Reactor[] }>;

export const REACTION_EMOJIS = ["🔥", "👏", "👎"] as const;

// Wider set for clan chat's hold-to-react picker — a transient tray, not a persistent pill row
// like ReactionBar's, so it can afford more options without adding visual noise to every message.
export const CHAT_REACTION_EMOJIS = ["🔥", "👏", "👎", "❤️", "😂", "😮", "😢", "🙏"] as const;

export type Reactor = { id: string; name: string; avatarUrl: string | null };

export type ReactionSummary = Record<string, { reactedByMe: boolean; users: Reactor[] }>;

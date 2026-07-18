export type ContractTier = 1 | 2 | 3;

export type ContractEvalContext = {
  userId: string;
  clanId: string;
  /** Start/end of the clan-wide day being resolved (Asia/Kolkata) — see catalog.ts's top comment
   * for why contracts evaluate on this shared boundary rather than each member's own timezone. */
  dayStart: Date;
  dayEnd: Date;
  /** The claim's own meta — duel opponentUserId, wager stake — null for contracts that don't need it. */
  meta: Record<string, unknown> | null;
};

export type ContractEvalResult = { completed: boolean; pointsAwarded: number };

export type ContractDefinition = {
  id: string;
  tier: ContractTier;
  title: string;
  description: string;
  points: number;
  /** Called once, by the daily resolution cron, after the clan's day has ended. */
  evaluate: (ctx: ContractEvalContext) => Promise<ContractEvalResult>;
  /** True for contracts that need a per-claim random opponent (duels) — resolved at claim time. */
  needsOpponent?: boolean;
  /** True for the wager contract — the claim's meta.stake is deducted on failure, multiplied on success. */
  isWager?: boolean;
};

export type ContractBoardEntry = {
  contract: Pick<ContractDefinition, "id" | "tier" | "title" | "description" | "points">;
  claim: {
    userId: string;
    userName: string;
    userAvatarUrl: string | null;
    status: "claimed" | "completed" | "failed";
  } | null;
};

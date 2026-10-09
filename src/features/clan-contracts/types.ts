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
  /** For contracts whose completion threshold depends on the viewer's own historical data (e.g.
   * "beat your average") — computes today's concrete numeric target so the board can show it
   * instead of leaving the member to guess from a relative description. Evaluated per-viewer
   * (whoever is looking at the board), not per-claimant, since the target must be known before
   * anyone claims it. Undefined for contracts with a fixed/absolute threshold already spelled out
   * in their description (e.g. "10k steps"). */
  getTarget?: (ctx: { userId: string; dayStart: Date }) => Promise<number | null>;
};

export type ContractBoardEntry = {
  contract: Pick<ContractDefinition, "id" | "tier" | "title" | "description" | "points">;
  claim: {
    userId: string;
    userName: string;
    userAvatarUrl: string | null;
    status: "claimed" | "completed" | "failed";
    /** Set only for needsOpponent (duel) contracts — who the claimant was matched against. */
    opponentName?: string;
    /** Duels only — both sides' steps so far today, for the live scoreboard on the card. */
    duelSteps?: { claimant: number; opponent: number };
  } | null;
  /** The viewer's own concrete step target for this contract today, if it has one — see
   * ContractDefinition.getTarget. */
  targetSteps?: number;
};

/** Payload of a realtime "contract_moment" event — shown as a toast to clanmates with the app open.
 * Only things already visible on the clan's contract board, so it's safe to relay. */
export type ContractMoment = {
  kind: "claimed" | "completed";
  contractTitle: string;
  userId: string;
  userName: string;
  points: number;
  /** Duels only — lets the rival get "X challenged you" instead of the generic claim toast. */
  opponentUserId?: string;
  opponentName?: string;
};

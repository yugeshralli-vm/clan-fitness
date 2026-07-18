export { claimContract, fetchContractBoard } from "./actions";
export type { ClaimContractResult } from "./actions";
export { levelForPoints, levelProgress, pointsForLevel } from "./level";
export type { LevelCurveConfig, LevelProgress } from "./level";
export { ContractsCard } from "./components/ContractsCard";
export { ProfileLevelSummary } from "./components/ProfileLevelSummary";
export type { ContractBoardEntry, ContractTier } from "./types";

// `getContractBoard` (./queries) and the catalog/resolve modules are intentionally not
// re-exported here: queries.ts and catalog.ts are `server-only` (catalog.ts pulls in
// eval-helpers.ts, which queries the DB directly), and this barrel is imported by Client
// Components (e.g. ContractsCard) — pull them in directly instead:
// `@/features/clan-contracts/queries`, `@/features/clan-contracts/resolve`.

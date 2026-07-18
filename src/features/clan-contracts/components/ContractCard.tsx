"use client";

import { useState } from "react";
import { Avatar } from "@/components/shared/Avatar";
import type { ContractBoardEntry } from "../types";

const TIER_CLASSES: Record<1 | 2 | 3, string> = {
  1: "border-surface-border bg-surface",
  2: "border-accent/50 bg-accent/5",
  3: "border-amber-400/50 bg-gradient-to-br from-amber-400/10 to-yellow-300/10 shadow-[0_0_0_1px_rgba(251,191,36,0.15)]",
};

const TIER_LABEL: Record<1 | 2 | 3, string> = { 1: "Tier 1", 2: "Tier 2", 3: "Tier 3" };

export function ContractCard({
  entry,
  pending,
  onClaim,
}: {
  entry: ContractBoardEntry;
  pending: boolean;
  onClaim: (contractId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { contract, claim } = entry;

  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-4 ${TIER_CLASSES[contract.tier]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
            {TIER_LABEL[contract.tier]}
          </p>
          <p className="font-semibold text-foreground">{contract.title}</p>
        </div>
        <span className="shrink-0 rounded-full border border-surface-border bg-background px-2 py-0.5 text-xs font-bold text-foreground">
          {contract.points}pt
        </span>
      </div>
      <p className="text-sm text-foreground-secondary">{contract.description}</p>

      {claim ? (
        <div className="mt-1 flex items-center gap-2 rounded-md bg-background/60 px-2 py-1.5 text-xs text-foreground-tertiary">
          <Avatar src={claim.userAvatarUrl} name={claim.userName} size={18} />
          <span className="truncate">Claimed by {claim.userName}</span>
        </div>
      ) : confirming ? (
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="flex-1 rounded-md border border-surface-border px-3 py-1.5 text-sm text-foreground-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onClaim(contract.id)}
            className="flex-1 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          >
            {pending ? "Claiming…" : "Confirm"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-1 rounded-md border border-dashed border-surface-border px-3 py-1.5 text-sm font-semibold text-accent"
        >
          Claim this contract
        </button>
      )}
    </div>
  );
}

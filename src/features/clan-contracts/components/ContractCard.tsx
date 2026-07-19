"use client";

import { Check, Star } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/shared/Avatar";
import type { ContractBoardEntry, ContractTier } from "../types";

const TIER_BORDER: Record<1 | 2 | 3, string> = {
  1: "border-surface-border",
  2: "border-accent/60",
  3: "border-amber-400/60",
};

const TIER_STAR_CLASSES: Record<1 | 2 | 3, string> = {
  1: "text-foreground-tertiary",
  2: "text-accent",
  3: "text-amber-400",
};

export function TierStars({ tier, size = 10 }: { tier: ContractTier; size?: number }) {
  return (
    <span className={`flex items-center gap-0.5 ${TIER_STAR_CLASSES[tier]}`}>
      {Array.from({ length: tier }, (_, i) => (
        <Star key={i} size={size} fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  );
}

export function ContractCard({
  entry,
  pending,
  onClaim,
  claimDisabled,
  liveCompleted,
}: {
  entry: ContractBoardEntry;
  pending: boolean;
  onClaim: (contractId: string) => void;
  claimDisabled: boolean;
  liveCompleted: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const { contract, claim } = entry;

  return (
    <div
      className={`flex h-full min-w-0 flex-col gap-2 rounded-lg border bg-surface p-3 transition-opacity duration-300 ${TIER_BORDER[contract.tier]} ${liveCompleted ? "opacity-55" : ""}`}
    >
      {!imageFailed && (
        // Static per-contract image that may not exist yet (rolled out asset-by-asset); onError
        // swaps it out gracefully via state, which next/image doesn't support as cleanly for an
        // intentionally-optional asset.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/contracts/${contract.id}.png`}
          alt=""
          className={`aspect-square w-full rounded-md border border-surface-border/60 object-cover ${liveCompleted ? "grayscale" : ""}`}
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <TierStars tier={contract.tier} />
          <p className="truncate font-semibold text-foreground">{contract.title}</p>
        </div>
        <span className="shrink-0 rounded-full border border-surface-border bg-background px-1.5 py-0.5 text-[10px] font-bold text-foreground">
          {contract.points}pt
        </span>
      </div>
      <p className="flex-1 text-xs text-foreground-secondary">{contract.description}</p>

      {claim ? (
        <div className="mt-1 flex min-w-0 items-start gap-1.5 rounded-md bg-background/60 px-2 py-1.5 text-xs text-foreground-tertiary">
          <Avatar src={claim.userAvatarUrl} name={claim.userName} size={16} />
          <span className="line-clamp-2 min-w-0 flex-1">
            {claim.opponentName ? `${claim.userName} vs ${claim.opponentName}` : `Claimed by ${claim.userName}`}
          </span>
          {liveCompleted && <Check size={14} className="shrink-0 text-success" />}
        </div>
      ) : confirming ? (
        <div className="mt-1 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="flex-1 rounded-md border border-surface-border px-2 py-1.5 text-xs text-foreground-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onClaim(contract.id)}
            className="flex-1 rounded-md bg-accent px-2 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-60"
          >
            {pending ? "Claiming…" : "Confirm"}
          </button>
        </div>
      ) : claimDisabled ? (
        <p className="mt-1 rounded-md border border-dashed border-surface-border px-2 py-1.5 text-center text-xs text-foreground-tertiary">
          Come back tomorrow
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-1 rounded-md border border-dashed border-surface-border px-2 py-1.5 text-xs font-semibold text-accent"
        >
          Claim
        </button>
      )}
    </div>
  );
}

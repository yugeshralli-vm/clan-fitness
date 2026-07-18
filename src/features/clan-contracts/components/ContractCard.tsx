"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/shared/Avatar";
import type { ContractBoardEntry, ContractTier } from "../types";

const TIER_CLASSES: Record<1 | 2 | 3, string> = {
  1: "border-surface-border bg-surface",
  2: "border-accent/50 bg-accent/5",
  3: "border-amber-400/50 bg-gradient-to-br from-amber-400/10 to-yellow-300/10 shadow-[0_0_0_1px_rgba(251,191,36,0.15)]",
};

const TIER_STAR_CLASSES: Record<1 | 2 | 3, string> = {
  1: "text-foreground-tertiary",
  2: "text-accent",
  3: "text-amber-500",
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
}: {
  entry: ContractBoardEntry;
  pending: boolean;
  onClaim: (contractId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { contract, claim } = entry;

  return (
    <div className={`flex h-full min-w-0 flex-col gap-2 rounded-lg border p-3 ${TIER_CLASSES[contract.tier]}`}>
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex min-w-0 items-start gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- static per-contract icon that
              may not exist yet (rolled out asset-by-asset); onError hides it gracefully, which
              next/image doesn't support as cleanly for an intentionally-optional local asset. */}
          <img
            src={`/contracts/${contract.id}.png`}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-md border border-surface-border/60 object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
          <div className="min-w-0">
            <TierStars tier={contract.tier} />
            <p className="truncate font-semibold text-foreground">{contract.title}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-surface-border bg-background px-1.5 py-0.5 text-[10px] font-bold text-foreground">
          {contract.points}pt
        </span>
      </div>
      <p className="flex-1 text-xs text-foreground-secondary">{contract.description}</p>

      {claim ? (
        <div className="mt-1 flex min-w-0 items-center gap-1.5 rounded-md bg-background/60 px-2 py-1.5 text-xs text-foreground-tertiary">
          <Avatar src={claim.userAvatarUrl} name={claim.userName} size={16} />
          <span className="min-w-0 flex-1 truncate">Claimed by {claim.userName}</span>
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

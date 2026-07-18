"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { claimContract, fetchContractBoard } from "../actions";
import type { ContractBoardEntry, ContractTier } from "../types";
import { ContractCard, TierStars } from "./ContractCard";

const POLL_INTERVAL_MS = 5000;
const TIER_ORDER: ContractTier[] = [1, 2, 3];
const TIER_TITLE: Record<ContractTier, string> = { 1: "Easy", 2: "A challenge", 3: "Legendary" };

export function ContractsBoard({ clanId, initialBoard }: { clanId: string; initialBoard: ContractBoardEntry[] }) {
  const [board, setBoard] = useState(initialBoard);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const interval = setInterval(async () => {
      setBoard(await fetchContractBoard(clanId));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [clanId]);

  function handleClaim(contractId: string) {
    startTransition(async () => {
      const result = await claimContract(clanId, contractId);
      if ("error" in result) {
        toast.error(result.error);
        setBoard(await fetchContractBoard(clanId));
      } else {
        setBoard(result.board);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {TIER_ORDER.map((tier) => {
        const entries = board.filter((entry) => entry.contract.tier === tier);
        if (entries.length === 0) return null;
        return (
          <div key={tier} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground-tertiary">
              <TierStars tier={tier} size={14} />
              {TIER_TITLE[tier]}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {entries.map((entry) => (
                <ContractCard key={entry.contract.id} entry={entry} pending={pending} onClaim={handleClaim} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

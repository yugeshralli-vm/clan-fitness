"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { claimContract, fetchContractBoard, getMyLiveClaimProgress } from "../actions";
import type { ContractBoardEntry, ContractTier } from "../types";
import { ContractCard, TierStars } from "./ContractCard";

const POLL_INTERVAL_MS = 5000;
const TIER_ORDER: ContractTier[] = [1, 2, 3];
const TIER_TITLE: Record<ContractTier, string> = { 1: "Noob", 2: "Veteran", 3: "Legend" };

export function ContractsBoard({
  clanId,
  initialBoard,
  currentUserId,
  maxClaimsPerMemberPerDay,
}: {
  clanId: string;
  initialBoard: ContractBoardEntry[];
  currentUserId: string;
  maxClaimsPerMemberPerDay: number;
}) {
  const [board, setBoard] = useState(initialBoard);
  const [pending, startTransition] = useTransition();
  const [liveCompletedIds, setLiveCompletedIds] = useState<Set<string>>(new Set());
  const myClaimsToday = board.filter((entry) => entry.claim?.userId === currentUserId).length;
  const atDailyCap = myClaimsToday >= maxClaimsPerMemberPerDay;
  // Tracks which contracts have already gotten their celebration toast, across polls — a claim
  // stays live-completed on every subsequent poll until the cron resolves it, so without this
  // we'd re-toast the same completion every 5s.
  const celebratedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(async () => {
      const [freshBoard, progress] = await Promise.all([fetchContractBoard(clanId), getMyLiveClaimProgress(clanId)]);
      setBoard(freshBoard);
      setLiveCompletedIds(new Set(progress.filter((p) => p.completed).map((p) => p.contractId)));
      for (const item of progress) {
        if (item.completed && !celebratedRef.current.has(item.contractId)) {
          celebratedRef.current.add(item.contractId);
          toast.success(`🎉 ${item.title} complete! +${item.points}pts`);
        }
      }
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
        if (result.justCompleted) {
          celebratedRef.current.add(contractId);
          setLiveCompletedIds((prev) => new Set(prev).add(contractId));
          toast.success(`🎉 ${result.justCompleted.title} complete! +${result.justCompleted.points}pts`);
        }
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
                <ContractCard
                  key={entry.contract.id}
                  entry={entry}
                  pending={pending}
                  onClaim={handleClaim}
                  claimDisabled={atDailyCap}
                  liveCompleted={liveCompletedIds.has(entry.contract.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

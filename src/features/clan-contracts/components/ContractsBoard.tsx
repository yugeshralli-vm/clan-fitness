"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { celebrate } from "@/components/ui/reward-snackbar";
import { toast } from "@/components/ui/toast";
import { claimContract, fetchContractBoard, getLiveClaimProgress } from "../actions";
import type { ContractBoardEntry, ContractTier } from "../types";
import { ContractCard, TierStars } from "./ContractCard";

const POLL_INTERVAL_MS = 5000;
const TIER_ORDER: ContractTier[] = [1, 2, 3];
const TIER_TITLE: Record<ContractTier, string> = { 1: "Noob", 2: "Veteran", 3: "Legend" };

function celebratedClaimsKey(userId: string) {
  return `contract-celebrated-claims:${userId}`;
}

// Claim ids already celebrated, persisted so revisiting/remounting this page (a claim stays
// live-completed on every poll all day, until the cron resolves it) doesn't replay the same
// celebration — an in-memory ref alone resets on every mount.
function loadCelebratedClaims(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(celebratedClaimsKey(userId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveCelebratedClaims(userId: string, ids: Set<string>) {
  localStorage.setItem(celebratedClaimsKey(userId), JSON.stringify([...ids]));
}

function liveCompletedKey(userId: string, clanId: string) {
  return `contract-live-completed:${userId}:${clanId}`;
}

// Last known live-completed contract ids (clan-wide — whoever claimed it), persisted so a card
// that was already checked off on a prior visit renders that way immediately, instead of blanking
// out until the first poll response comes back — same reasoning as loadCelebratedClaims above.
function loadLiveCompleted(userId: string, clanId: string): Set<string> {
  try {
    const raw = localStorage.getItem(liveCompletedKey(userId, clanId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveLiveCompleted(userId: string, clanId: string, ids: Set<string>) {
  localStorage.setItem(liveCompletedKey(userId, clanId), JSON.stringify([...ids]));
}

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
  // Seeded from the last poll's result (loadCelebratedClaims/loadLiveCompleted are SSR-safe —
  // they read localStorage in a try/catch, which throws and falls back to empty on the server) so
  // a card already known to be live-completed renders that way immediately, instead of blanking
  // out until the first poll response comes back.
  const [liveCompletedIds, setLiveCompletedIds] = useState<Set<string>>(() => loadLiveCompleted(currentUserId, clanId));
  const myClaimsToday = board.filter((entry) => entry.claim?.userId === currentUserId).length;
  const atDailyCap = myClaimsToday >= maxClaimsPerMemberPerDay;
  const celebratedRef = useRef<Set<string>>(loadCelebratedClaims(currentUserId));

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const [freshBoard, progress] = await Promise.all([fetchContractBoard(clanId), getLiveClaimProgress(clanId)]);
      if (cancelled) return;
      setBoard(freshBoard);
      const completedIds = new Set(progress.filter((p) => p.completed).map((p) => p.contractId));
      setLiveCompletedIds(completedIds);
      saveLiveCompleted(currentUserId, clanId, completedIds);
      // Only celebrate the viewer's own completions — seeing everyone else's claims checked off
      // is the point of the tick, but a toast for someone else's contract would just be noise.
      for (const item of progress) {
        if (item.completed && item.userId === currentUserId && !celebratedRef.current.has(item.claimId)) {
          celebratedRef.current.add(item.claimId);
          saveCelebratedClaims(currentUserId, celebratedRef.current);
          celebrate.contractComplete(item.title, item.points);
        }
      }
    }

    // Runs immediately, not just on the first interval tick, so the board reflects live state
    // right away instead of showing stale/blank data for the first 5s of every visit.
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [clanId, currentUserId]);

  function handleClaim(contractId: string) {
    startTransition(async () => {
      const result = await claimContract(clanId, contractId);
      if ("error" in result) {
        toast.error(result.error);
        setBoard(await fetchContractBoard(clanId));
      } else {
        setBoard(result.board);
        const opponentName = result.board.find((entry) => entry.contract.id === contractId)?.claim?.opponentName;
        if (opponentName) {
          celebrate.duelMatched(opponentName);
        }
        if (result.justCompleted) {
          celebratedRef.current.add(result.justCompleted.claimId);
          saveCelebratedClaims(currentUserId, celebratedRef.current);
          setLiveCompletedIds((prev) => new Set(prev).add(contractId));
          celebrate.contractComplete(result.justCompleted.title, result.justCompleted.points);
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

"use client";

import { toast } from "@/components/ui/toast";
import { useRealtimeStream } from "@/features/realtime";
import type { ContractMoment } from "../types";

function message(moment: ContractMoment, currentUserId: string) {
  if (moment.kind === "completed") return `✅ ${moment.userName} completed ${moment.contractTitle} (+${moment.points})`;
  if (moment.opponentUserId === currentUserId) return `⚔️ ${moment.userName} challenged you: ${moment.contractTitle}`;
  if (moment.opponentName) return `⚔️ ${moment.userName} vs ${moment.opponentName}: ${moment.contractTitle}`;
  return `🎯 ${moment.userName} claimed ${moment.contractTitle}`;
}

/** Renders nothing — shows a toast when a clanmate claims or completes a contract, anywhere in
 * the app. The viewer's own moments are skipped; they already get the board's own celebration. */
export function ContractMomentToasts({ currentUserId }: { currentUserId: string }) {
  useRealtimeStream("contract_moment", (frame) => {
    if (frame.actor === currentUserId || !frame.data) return;
    toast.success(message(frame.data as ContractMoment, currentUserId));
  });
  return null;
}

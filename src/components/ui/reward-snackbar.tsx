"use client";

import { PartyPopper, Sparkles, Swords } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type RewardVariant = "contract" | "level" | "duel";
type RewardEntry = { id: string; variant: RewardVariant; eyebrow: string; title: string; badge?: string };

const DURATION_MS = 4200;
const MAX_VISIBLE = 2;

// Separate singleton store from ./toast — these two moments (contract complete, level up) are
// meant to feel like a bigger deal than a plain success toast, so they get their own bolder
// presentation rather than another variant of ToastItem.
let rewards: RewardEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function dismiss(id: string) {
  rewards = rewards.filter((entry) => entry.id !== id);
  emit();
}

function push(variant: RewardVariant, eyebrow: string, title: string, badge?: string) {
  const id = crypto.randomUUID();
  rewards = [...rewards, { id, variant, eyebrow, title, badge }].slice(-MAX_VISIBLE);
  emit();
  setTimeout(() => dismiss(id), DURATION_MS);
}

export const celebrate = {
  contractComplete: (contractTitle: string, points: number) =>
    push("contract", "Contract complete", contractTitle, `+${points}`),
  levelUp: (level: number) => push("level", "Level up!", `Level ${level}`),
  duelMatched: (opponentName: string) => push("duel", "Duel matched!", `You vs ${opponentName}`),
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return rewards;
}

function getServerSnapshot(): RewardEntry[] {
  return [];
}

export function RewardSnackbar() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (items.length === 0) return null;

  return createPortal(
    <div
      // Sits above the plain Toaster's zone (z-70 vs its z-60, extra bottom clearance) so the two
      // don't visually collide on the rare occasion both fire at once.
      className="pointer-events-none fixed inset-x-0 z-70 flex flex-col-reverse items-center gap-2 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] px-4 sm:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
    >
      {items.map((entry) => (
        <RewardItem key={entry.id} entry={entry} />
      ))}
    </div>,
    document.body,
  );
}

function RewardItem({ entry }: { entry: RewardEntry }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setLeaving(true), DURATION_MS - 250);
    return () => clearTimeout(timeout);
  }, []);

  const Icon = entry.variant === "level" ? Sparkles : entry.variant === "duel" ? Swords : PartyPopper;

  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-[calc(100vw-2rem)] max-w-sm items-center gap-3 rounded-2xl border border-accent/50 bg-surface px-4 py-3.5 shadow-[0_0_28px_-8px_var(--accent)] transition-all duration-300 ${
        leaving ? "translate-y-2 scale-95 opacity-0" : "animate-[reward-in_0.4s_cubic-bezier(0.34,1.56,0.64,1)]"
      }`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold tracking-wide text-accent uppercase">{entry.eyebrow}</p>
        <p className="truncate text-base font-bold text-foreground">{entry.title}</p>
      </div>
      {entry.badge && (
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-sm font-bold text-accent-foreground">
          {entry.badge}
        </span>
      )}
    </div>
  );
}

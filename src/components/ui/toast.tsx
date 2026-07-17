"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type ToastVariant = "success" | "error";
type ToastEntry = { id: string; message: string; variant: ToastVariant };

const DURATIONS: Record<ToastVariant, number> = { success: 2500, error: 4000 };
const MAX_VISIBLE = 3;

// Module-level singleton store, not a Context provider — lets any client component call
// toast.success(...)/toast.error(...) with no prop-drilling and no wrapping the app in a new
// Provider (this codebase's only app-wide Context is ClerkProvider). useSyncExternalStore is the
// correct primitive to subscribe <Toaster> to this external, non-React state.
let toasts: ToastEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function dismiss(id: string) {
  toasts = toasts.filter((entry) => entry.id !== id);
  emit();
}

function push(variant: ToastVariant, message: string) {
  const id = crypto.randomUUID();
  // Cap at MAX_VISIBLE — oldest silently evicted. A queue is overkill for a UI element that's
  // meant to be glanced at, not read in full once a third one is already stacking up.
  toasts = [...toasts, { id, message, variant }].slice(-MAX_VISIBLE);
  emit();
  setTimeout(() => dismiss(id), DURATIONS[variant]);
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

function getServerSnapshot(): ToastEntry[] {
  return [];
}

export function Toaster() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (items.length === 0) return null;

  return createPortal(
    <div
      // Bottom-center: clears BottomNav on mobile (same breakpoint-driven offset ClanChatFab
      // already uses) and ClanChatFab's own bottom-right position, without any z-index coordination
      // between the two. z-60 — one above BottomSheet's z-50, so a toast fired from within an open
      // sheet still surfaces above it.
      className="pointer-events-none fixed inset-x-0 z-60 flex flex-col-reverse items-center gap-2 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] px-4 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
    >
      {items.map((entry) => (
        <ToastItem key={entry.id} entry={entry} />
      ))}
    </div>,
    document.body,
  );
}

function ToastItem({ entry }: { entry: ToastEntry }) {
  const [leaving, setLeaving] = useState(false);

  // Each toast is a freshly-mounted node with a unique key (never reused/toggled in place like
  // BottomSheet's single persistent node), so the CSS keyframe below always plays its entrance on
  // mount with no risk of a skipped first frame — no rAF dance needed. The exit flip only has to
  // survive a couple hundred ms before the store's own dismiss() timer unmounts this node for real.
  useEffect(() => {
    const timeout = setTimeout(() => setLeaving(true), DURATIONS[entry.variant] - 200);
    return () => clearTimeout(timeout);
  }, [entry.variant]);

  const Icon = entry.variant === "success" ? CircleCheck : CircleX;
  const iconColor = entry.variant === "success" ? "text-success" : "text-danger";

  return (
    <div
      role="status"
      className={`pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl border border-surface-border bg-surface px-4 py-3 shadow-lg transition-all duration-200 ${
        leaving ? "translate-y-1 opacity-0" : "animate-[toast-in_0.2s_ease-out]"
      }`}
    >
      <Icon size={18} className={`shrink-0 ${iconColor}`} />
      <p className="text-sm text-foreground">{entry.message}</p>
    </div>
  );
}

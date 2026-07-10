"use client";

import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { hasBeenPrompted, markPrompted } from "../prompted";
import { usePushSubscription } from "../usePushSubscription";

const PROMPT_DELAY_MS = 1500;

/**
 * Prompts existing users to enable push the first time they load the app after this feature
 * shipped, instead of waiting for a manual opt-in. Only fires once per browser (tracked in
 * localStorage) and is a no-op for anyone who already went through this prompt, already has a
 * subscription, or already denied notifications at the browser level.
 *
 * Deliberately an explicit in-app ask (a dismissible sheet), not an automatic subscribe() call:
 * calling subscribe() immediately triggers the browser's native permission dialog with no
 * explanation, which both gets reflexively dismissed more often and, on most browsers, can't be
 * re-prompted programmatically once denied. The short delay before showing the sheet is so it
 * doesn't slide up the instant a page loads — including right after a brand-new user has just
 * clicked through the welcome page into their first real page.
 */
export function AutoEnableNotifications() {
  const { support, subscription, pending, subscribe } = usePushSubscription();
  const attempted = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (attempted.current || support !== "supported" || subscription) return;
    if (hasBeenPrompted()) return;
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      markPrompted();
      return;
    }
    attempted.current = true;
    const timeout = setTimeout(() => setOpen(true), PROMPT_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [support, subscription]);

  function handleEnable() {
    subscribe().finally(() => {
      markPrompted();
      setOpen(false);
    });
  }

  function handleDismiss() {
    markPrompted();
    setOpen(false);
  }

  return (
    <BottomSheet open={open} onClose={handleDismiss} title="Stay in the loop">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground-secondary">
          Get notified when someone reacts, comments, mentions you, or nudges you to log — so you
          never miss it.
        </p>
        <div className="flex gap-2">
          <Button type="button" onClick={handleEnable} disabled={pending}>
            {pending ? "Enabling..." : "Enable notifications"}
          </Button>
          <Button type="button" variant="secondary" onClick={handleDismiss}>
            Not now
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

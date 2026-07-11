"use client";

import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { hasBeenPrompted } from "@/features/notifications";
import { isIOSDevice, isStandaloneDisplay } from "@/lib/pwa";
import { hasBeenPromptedToInstall, markInstallPrompted } from "./installPrompted";

const PROMPT_DELAY_MS = 1500;
const POLL_INTERVAL_MS = 1000;
// iOS Safari not yet added to the home screen never shows the notification soft-ask at all (push
// isn't available there until installed), so hasBeenPrompted() below would never become true for
// that profile — without a cap this interval ran forever, every second, for the entire time such
// a user stayed on any page in the app.
const MAX_POLL_ATTEMPTS = 30;

// Not in the DOM lib types — this is a non-standard Chromium-only event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * One-time "add to home screen" prompt. Deliberately waits for the notification soft-ask
 * (AutoEnableNotifications) to resolve first, polling its localStorage flag rather than sharing
 * live component state — the two features are otherwise unrelated, and this is the simplest way
 * to guarantee these one-time bottom sheets never both pop up at once.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<"native" | "ios" | null>(null);
  const shown = useRef(false);

  useEffect(() => {
    if (isStandaloneDisplay() || hasBeenPromptedToInstall()) return;

    function handler(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (shown.current || isStandaloneDisplay() || hasBeenPromptedToInstall()) return;
    if (!deferredPrompt && !isIOSDevice()) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (!hasBeenPrompted() && attempts < MAX_POLL_ATTEMPTS) return;
      clearInterval(interval);
      shown.current = true;
      timeout = setTimeout(() => {
        setVariant(deferredPrompt ? "native" : "ios");
        setOpen(true);
      }, PROMPT_DELAY_MS);
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [deferredPrompt]);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    markInstallPrompted();
    setOpen(false);
  }

  function handleDismiss() {
    markInstallPrompted();
    setOpen(false);
  }

  if (!variant) return null;

  return (
    <BottomSheet open={open} onClose={handleDismiss} title="Add Clan Fitness to your home screen">
      {variant === "native" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground-secondary">
            Quicker access, and notifications work best when installed.
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={handleInstall}>
              Install
            </Button>
            <Button type="button" variant="secondary" onClick={handleDismiss}>
              Not now
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground-secondary">
            Tap the Share button, then &quot;Add to Home Screen&quot;. Quicker access, and
            notifications work best when installed this way.
          </p>
          <Button type="button" onClick={handleDismiss}>
            Got it
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}

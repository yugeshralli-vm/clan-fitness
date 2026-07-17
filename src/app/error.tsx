"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// App-wide fallback for any thrown error the app doesn't otherwise catch (Next.js App Router's
// error.tsx convention). A handful of actions in this app still throw a plain Error on failure
// (see e.g. clans/actions.ts's makeAdmin/removeMember/leaveClan) rather than returning a { error }
// state — until those are converted, this is what stands between that and a blank crash screen.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold text-foreground">Something went wrong.</p>
      <p className="max-w-xs text-sm text-foreground-tertiary">
        Give it another try — if it keeps happening, come back in a bit.
      </p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

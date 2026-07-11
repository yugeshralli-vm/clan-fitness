"use client";

import { MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { fetchFeedbackThread } from "@/features/feedback/actions";
import { ChatThread } from "@/features/feedback/components/ChatThread";
import type { FeedbackMessageRow } from "@/features/feedback/queries";

export function FeedbackFab({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<FeedbackMessageRow[] | null>(null);

  if (pathname === "/feedback") return null;

  function handleOpen() {
    setOpen(true);
    setMessages(null);
    fetchFeedbackThread(userId).then(setMessages);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Send feedback"
        className="fixed bottom-20 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform active:scale-95 sm:bottom-6"
      >
        <MessageSquare size={22} />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Feedback">
        {messages === null ? (
          <p className="py-8 text-center text-sm text-foreground-tertiary">Loading...</p>
        ) : (
          <ChatThread threadUserId={userId} viewerRole="user" initialMessages={messages} />
        )}
      </BottomSheet>
    </>
  );
}

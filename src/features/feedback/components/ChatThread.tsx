"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchFeedbackThread, sendFeedbackMessage } from "../actions";
import type { FeedbackMessageRow } from "../queries";
import { FEEDBACK_MESSAGE_MAX_LENGTH, type ChatViewerRole } from "../types";

const POLL_INTERVAL_MS = 2000;

/**
 * Shared by the tester-facing /feedback page and the admin's per-user thread view. "Near-zero
 * latency" without any new realtime infrastructure: the sender's own message appears immediately
 * (optimistic, before the server confirms) and a 2s poll picks up the other party's messages —
 * more than fast enough for a support chat, at zero added infra cost. The poll interval is always
 * cleared on unmount with no conditional path that could skip it.
 */
export function ChatThread({
  threadUserId,
  viewerRole,
  initialMessages,
}: {
  threadUserId: string;
  viewerRole: ChatViewerRole;
  initialMessages: FeedbackMessageRow[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const fresh = await fetchFeedbackThread(threadUserId);
      setMessages(fresh);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [threadUserId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || pending) return;

    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, userId: threadUserId, sender: viewerRole, body, createdAt: new Date() },
    ]);
    setText("");
    setPending(true);
    setError(undefined);

    const formData = new FormData();
    formData.set("body", body);
    const result = await sendFeedbackMessage(threadUserId, undefined, formData);
    setPending(false);

    if (result?.error) {
      setError(result.error);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      return;
    }

    setMessages(await fetchFeedbackThread(threadUserId));
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div ref={listRef} className="flex max-h-[60vh] min-h-[50vh] flex-col gap-2 overflow-y-auto">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-foreground-tertiary">
            {viewerRole === "user" ? "Say hi — bug reports, ideas, anything goes." : "No messages yet."}
          </p>
        )}
        {messages.map((message) => {
          const mine = message.sender === viewerRole;
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
                  mine
                    ? "bg-accent text-accent-foreground"
                    : "border border-surface-border bg-surface text-foreground-secondary"
                }`}
              >
                {message.body}
              </p>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
          placeholder="Type a message..."
          aria-label="Message"
        />
        <Button type="submit" disabled={pending || !text.trim()}>
          Send
        </Button>
      </form>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

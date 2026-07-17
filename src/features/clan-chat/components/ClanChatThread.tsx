"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/shared/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchClanMessages, sendClanMessage } from "../actions";
import type { ClanMessageRow } from "../queries";
import { CLAN_MESSAGE_MAX_LENGTH } from "../types";

const POLL_INTERVAL_MS = 2000;

/**
 * "Near-zero latency" without any new realtime infrastructure: the sender's own message appears
 * immediately (optimistic, before the server confirms) and a 2s poll picks up every other
 * member's messages — more than fast enough for a clan-sized group, at zero added infra cost. The
 * poll interval is always cleared on unmount with no conditional path that could skip it.
 */
export function ClanChatThread({
  clanId,
  currentUser,
  initialMessages,
}: {
  clanId: string;
  currentUser: { id: string; name: string; avatarUrl: string | null };
  initialMessages: ClanMessageRow[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const fresh = await fetchClanMessages(clanId);
      setMessages(fresh);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [clanId]);

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
      {
        id: optimisticId,
        clanId,
        userId: currentUser.id,
        authorName: currentUser.name,
        authorAvatarUrl: currentUser.avatarUrl,
        body,
        createdAt: new Date(),
      },
    ]);
    setText("");
    setPending(true);
    setError(undefined);

    const formData = new FormData();
    formData.set("body", body);
    const result = await sendClanMessage(clanId, undefined, formData);
    setPending(false);

    if (result?.error) {
      setError(result.error);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      return;
    }

    setMessages(await fetchClanMessages(clanId));
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div ref={listRef} className="flex max-h-[70vh] min-h-[50vh] flex-col gap-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-foreground-tertiary">
            No messages yet — say hi to your clan.
          </p>
        )}
        {messages.map((message) => {
          const mine = message.userId === currentUser.id;
          return (
            <div key={message.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              {!mine && <Avatar src={message.authorAvatarUrl} name={message.authorName} size={28} />}
              <div className={`flex max-w-[75%] flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
                {!mine && (
                  <span className="px-1 text-xs font-semibold text-foreground-tertiary">
                    {message.authorName}
                  </span>
                )}
                <p
                  className={`whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
                    mine
                      ? "bg-accent text-accent-foreground"
                      : "border border-surface-border bg-surface text-foreground-secondary"
                  }`}
                >
                  {message.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={CLAN_MESSAGE_MAX_LENGTH}
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

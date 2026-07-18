"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MentionInput, type MentionInputHandle, type MentionMember } from "@/components/shared/MentionInput";
import { Button } from "@/components/ui/button";
import { mentionsToPlainText } from "@/lib/mentions";
import { fetchClanMessages, sendClanMessage } from "../actions";
import type { ClanMessageRow } from "../queries";
import { CLAN_MESSAGE_MAX_LENGTH } from "../types";
import { ClanChatMessageRow } from "./ClanChatMessageRow";

type ReplyingTo = { id: string; authorName: string; body: string };

const POLL_INTERVAL_MS = 2000;

function chatSeenKey(clanId: string) {
  return `clan-chat-seen:${clanId}`;
}

/**
 * "Near-zero latency" without any new realtime infrastructure: the sender's own message appears
 * immediately (optimistic, before the server confirms) and a 2s poll picks up every other
 * member's messages — more than fast enough for a clan-sized group, at zero added infra cost. The
 * poll interval is always cleared on unmount with no conditional path that could skip it.
 */
export function ClanChatThread({
  clanId,
  currentUser,
  members,
  initialMessages,
}: {
  clanId: string;
  currentUser: { id: string; name: string; avatarUrl: string | null; level: number };
  members: MentionMember[];
  initialMessages: ClanMessageRow[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mentionInputRef = useRef<MentionInputHandle>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const fresh = await fetchClanMessages(clanId);
      setMessages(fresh);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [clanId]);

  // The list itself never overflows internally — this page scrolls at the window level (see
  // ClanChatPage's plain flex layout, no fixed-height ancestor), so scrolling has to move the
  // sentinel below the last message into view rather than the list div's own scroll position.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Marks this clan's chat "seen" the moment it's opened — same "visiting the page marks it seen"
  // model BottomNav already uses for the feed's own unread dot (see feedSeenKey there), just keyed
  // per-feature so the two dots track independently.
  useEffect(() => {
    localStorage.setItem(chatSeenKey(clanId), new Date().toISOString());
  }, [clanId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const displayBody = text.trim();
    if (!displayBody || pending) return;
    const markupBody = mentionInputRef.current?.getMarkupValue().trim() || displayBody;

    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        clanId,
        userId: currentUser.id,
        authorName: currentUser.name,
        authorAvatarUrl: currentUser.avatarUrl,
        authorLevel: currentUser.level,
        body: markupBody,
        createdAt: new Date(),
        replyToMessageId: replyingTo?.id ?? null,
        replyToAuthorName: replyingTo?.authorName ?? null,
        replyToBody: replyingTo?.body ?? null,
        reactionsSummary: {},
      },
    ]);
    setText("");
    mentionInputRef.current?.reset();
    setPending(true);
    setError(undefined);

    const formData = new FormData();
    formData.set("body", markupBody);
    if (replyingTo) formData.set("replyToMessageId", replyingTo.id);
    setReplyingTo(null);
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
      <div className="flex flex-col gap-3 pb-24">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-foreground-tertiary">
            No messages yet — say hi to your clan.
          </p>
        )}
        {messages.map((message) => (
          <ClanChatMessageRow
            key={message.id}
            message={message}
            mine={message.userId === currentUser.id}
            currentUserId={currentUser.id}
            onReply={(replied) =>
              setReplyingTo({ id: replied.id, authorName: replied.authorName, body: replied.body })
            }
            onReact={(messageId, summary) =>
              setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactionsSummary: summary } : m)))
            }
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Fixed above BottomNav on mobile (BottomNav is h-16 + its own safe-area padding, hidden
          from sm: up, matching the same bottom offset math used elsewhere — see toast.tsx). Inner
          content re-applies the page's own max-w-2xl/px-6 since a fixed element spans the full
          viewport width, unlike the normal-flow content around it. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-surface-border bg-surface sm:bottom-0">
        {replyingTo && (
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 border-b border-surface-border px-6 py-2">
            <div className="min-w-0 flex-1 border-l-2 border-accent pl-2">
              <p className="text-xs font-semibold text-accent">Replying to {replyingTo.authorName}</p>
              <p className="truncate text-xs text-foreground-tertiary">{mentionsToPlainText(replyingTo.body)}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="Cancel reply"
              className="-m-2 shrink-0 p-2 text-foreground-muted hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl items-center gap-2 px-6 py-3">
          <MentionInput
            ref={mentionInputRef}
            value={text}
            onChange={setText}
            members={members}
            excludeUserId={currentUser.id}
            allowEveryone
            maxLength={CLAN_MESSAGE_MAX_LENGTH}
            placeholder="Type a message... (@ to mention)"
          />
          <Button type="submit" disabled={pending || !text.trim()}>
            Send
          </Button>
        </form>
        {error && <p className="mx-auto max-w-2xl px-6 pb-2 text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}

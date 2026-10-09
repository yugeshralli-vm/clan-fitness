"use client";

import type { MentionMember } from "@/components/shared/MentionInput";

const MAX_NAMED_ONLINE = 2;

function firstName(member: MentionMember) {
  return member.name.split(" ")[0];
}

/** "Aarav is typing…" while anyone else is typing, otherwise who else has the app open. Renders
 * nothing when neither is known — presence is null without a realtime connection. */
export function ChatStatusLine({
  members,
  currentUserId,
  onlineUserIds,
  typingUserIds,
}: {
  members: MentionMember[];
  currentUserId: string;
  onlineUserIds: readonly string[] | null;
  typingUserIds: readonly string[];
}) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const typing = typingUserIds.flatMap((id) => byId.get(id) ?? []);
  // Only members of this clan — presence is per clan already, this just drops anyone who left
  // since the member list was rendered.
  const online = (onlineUserIds ?? []).filter((id) => id !== currentUserId).flatMap((id) => byId.get(id) ?? []);

  if (typing.length > 0) {
    const label =
      typing.length === 1
        ? `${firstName(typing[0])} is typing…`
        : typing.length === 2
          ? `${firstName(typing[0])} and ${firstName(typing[1])} are typing…`
          : "Several people are typing…";
    return (
      <p aria-live="polite" className="truncate text-xs text-foreground-tertiary">
        {label}
      </p>
    );
  }

  if (online.length === 0) return null;

  const named = online.slice(0, MAX_NAMED_ONLINE).map(firstName).join(", ");
  const rest = online.length - MAX_NAMED_ONLINE;
  return (
    <p className="flex items-center gap-1.5 truncate text-xs text-foreground-tertiary">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-success" />
      {rest > 0 ? `${named} + ${rest} online` : `${named} online`}
    </p>
  );
}

"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendBroadcast } from "../actions";
import type { getAllClansForAdmin, getAllUsersForAdmin } from "../queries";

type ClanOption = Awaited<ReturnType<typeof getAllClansForAdmin>>[number];
type UserOption = Awaited<ReturnType<typeof getAllUsersForAdmin>>[number];
type TargetType = "clan" | "user";

export function BroadcastComposer({ clans, users }: { clans: ClanOption[]; users: UserOption[] }) {
  const [state, formAction, pending] = useActionState(sendBroadcast, undefined);
  const submittedRef = useRef(false);
  const [step, setStep] = useState<"compose" | "confirm">("compose");
  const [targetType, setTargetType] = useState<TargetType>("clan");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedClans, setSelectedClans] = useState<Set<string>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [justSentCount, setJustSentCount] = useState<number | null>(null);

  // Reconciles useActionState's external result into local state (reset the form, show a success
  // line) once a send actually completes — distinguishes "just sent successfully" from the
  // initial (also error-free, also sentCount-less) state via submittedRef, same reasoning as
  // GoalsForm's ref. Can't be derived during render since it depends on a prior submission.
  useEffect(() => {
    if (!submittedRef.current || pending) return;
    submittedRef.current = false;
    if (state?.sentCount !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJustSentCount(state.sentCount);
      setTitle("");
      setBody("");
      setSelectedClans(new Set());
      setSelectedUsers(new Set());
      setStep("compose");
    }
  }, [pending, state]);

  const clanReachEstimate = useMemo(
    () => clans.filter((clan) => selectedClans.has(clan.id)).reduce((sum, clan) => sum + clan.memberCount, 0),
    [clans, selectedClans],
  );
  const reachEstimate = targetType === "clan" ? clanReachEstimate : selectedUsers.size;
  const hasSelection = targetType === "clan" ? selectedClans.size > 0 : selectedUsers.size > 0;
  const selectedClanList = clans.filter((clan) => selectedClans.has(clan.id));
  const selectedUserList = users.filter((user) => selectedUsers.has(user.id));

  function toggleClan(id: string) {
    setSelectedClans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleUser(id: string) {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleReview(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !body.trim() || !hasSelection) return;
    setJustSentCount(null);
    setStep("confirm");
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-surface-border bg-surface p-5">
      <h2 className="font-semibold text-foreground">Broadcast a message</h2>

      {justSentCount !== null && (
        <p className="text-sm text-success">
          Sent to {justSentCount} {justSentCount === 1 ? "person" : "people"}.
        </p>
      )}

      {step === "compose" ? (
        <form onSubmit={handleReview} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="broadcast-title" className="text-sm font-medium text-foreground">
              Title
            </label>
            <Input
              id="broadcast-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              placeholder="Heads up!"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="broadcast-body" className="text-sm font-medium text-foreground">
              Message
            </label>
            <textarea
              id="broadcast-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What's new..."
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Send to</span>
            <div className="flex gap-1 rounded-full border border-surface-border bg-background p-1">
              <button
                type="button"
                onClick={() => setTargetType("clan")}
                className={`min-h-8 min-w-0 flex-1 rounded-full px-3 text-xs font-semibold transition-colors ${
                  targetType === "clan"
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground-tertiary hover:text-foreground-secondary"
                }`}
              >
                <span className="block truncate">Clans</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetType("user")}
                className={`min-h-8 min-w-0 flex-1 rounded-full px-3 text-xs font-semibold transition-colors ${
                  targetType === "user"
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground-tertiary hover:text-foreground-secondary"
                }`}
              >
                <span className="block truncate">Users</span>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground-tertiary">
                {targetType === "clan" ? "Select clans" : "Select people"}
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    targetType === "clan"
                      ? setSelectedClans(new Set(clans.map((clan) => clan.id)))
                      : setSelectedUsers(new Set(users.map((user) => user.id)))
                  }
                  className="text-xs font-semibold text-accent"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => (targetType === "clan" ? setSelectedClans(new Set()) : setSelectedUsers(new Set()))}
                  className="text-xs text-foreground-tertiary"
                >
                  Clear
                </button>
              </div>
            </div>

            {targetType === "clan" ? (
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-surface-border p-2">
                {clans.length === 0 && <p className="text-sm text-foreground-tertiary">No clans yet.</p>}
                {clans.map((clan) => (
                  <label
                    key={clan.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-background"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClans.has(clan.id)}
                      onChange={() => toggleClan(clan.id)}
                      className="h-4 w-4 accent-accent"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground-secondary">{clan.name}</span>
                    <span className="shrink-0 text-xs text-foreground-muted">{clan.memberCount}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-surface-border p-2">
                {users.length === 0 && <p className="text-sm text-foreground-tertiary">No users yet.</p>}
                {users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-background"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="h-4 w-4 accent-accent"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground-secondary">{user.name}</span>
                  </label>
                ))}
              </div>
            )}

            {hasSelection &&
              (targetType === "clan" ? (
                <p className="text-xs text-foreground-tertiary">
                  Up to ~{reachEstimate} {reachEstimate === 1 ? "person" : "people"} across {selectedClans.size}{" "}
                  {selectedClans.size === 1 ? "clan" : "clans"} (fewer if some are in more than one selected clan).
                </p>
              ) : (
                <p className="text-xs text-foreground-tertiary">
                  {reachEstimate} {reachEstimate === 1 ? "person" : "people"} selected.
                </p>
              ))}
          </div>

          <Button type="submit" disabled={!title.trim() || !body.trim() || !hasSelection}>
            Review
          </Button>
        </form>
      ) : (
        <form
          action={(formData) => {
            submittedRef.current = true;
            formAction(formData);
          }}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="title" value={title} />
          <input type="hidden" name="body" value={body} />
          <input type="hidden" name="targetType" value={targetType} />
          {targetType === "clan"
            ? [...selectedClans].map((id) => <input key={id} type="hidden" name="clanIds" value={id} />)
            : [...selectedUsers].map((id) => <input key={id} type="hidden" name="userIds" value={id} />)}

          <div className="flex flex-col gap-2 rounded-lg border border-surface-border p-3">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="whitespace-pre-wrap text-sm text-foreground-secondary">{body}</p>
            <p className="text-xs text-foreground-tertiary">
              To {targetType === "clan"
                ? selectedClanList.map((clan) => clan.name).join(", ")
                : selectedUserList.map((user) => user.name).join(", ")}
              {" — "}
              {targetType === "clan" ? `up to ~${reachEstimate}` : reachEstimate}{" "}
              {reachEstimate === 1 ? "person" : "people"}.
            </p>
          </div>

          {state?.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Sending..." : "Send"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep("compose")}
              disabled={pending}
            >
              Back
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

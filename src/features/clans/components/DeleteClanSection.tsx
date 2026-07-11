"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteClan } from "../actions";

export function DeleteClanSection({
  clanId,
  clanName,
  memberCount,
}: {
  clanId: string;
  clanName: string;
  memberCount: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const action = deleteClan.bind(null, clanId);
  const [state, formAction, pending] = useActionState(action, undefined);

  if (!confirming) {
    return (
      <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
        Delete clan
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm text-foreground-secondary">
        This permanently deletes {clanName} for{" "}
        {memberCount === 1 ? "just you" : `all ${memberCount} members`}. Everyone&apos;s reactions
        and comments in this clan are removed. Check-ins themselves aren&apos;t affected — they
        stay in each member&apos;s own history.
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirmName" className="text-sm font-medium text-foreground">
          Type <span className="font-semibold">{clanName}</span> to confirm
        </label>
        <Input id="confirmName" name="confirmName" required autoComplete="off" />
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Deleting..." : "Delete clan"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

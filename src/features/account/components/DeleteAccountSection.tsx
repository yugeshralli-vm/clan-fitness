"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/lib/use-action-toast";
import { DELETE_ACCOUNT_CONFIRMATION, deleteMyAccount } from "../actions";

/** Same two-step pattern as DeleteClanSection: a danger button, then type-to-confirm. */
export function DeleteAccountSection() {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(deleteMyAccount, undefined);
  const markSubmitted = useActionToast(state, pending);

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-foreground">Delete account</p>
        <p className="text-xs text-foreground-tertiary">
          Permanently deletes your account and everything in it. This can&apos;t be undone.
        </p>
        <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
          Delete account
        </Button>
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        markSubmitted();
        formAction(formData);
      }}
      className="flex flex-col gap-3"
    >
      <p className="text-sm text-foreground-secondary">
        This permanently deletes your account, check-ins, photos, comments, reactions, chat messages, points and
        notifications. Clans you run are handed to their longest-standing member; a clan with no one else in it is
        deleted.
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirm" className="text-sm font-medium text-foreground">
          Type <span className="font-semibold">{DELETE_ACCOUNT_CONFIRMATION}</span> to confirm
        </label>
        <Input id="confirm" name="confirm" required autoComplete="off" autoCapitalize="characters" />
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Deleting..." : "Delete my account"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

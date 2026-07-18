"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useActionToast } from "@/lib/use-action-toast";
import { updateNotificationPreferences } from "../actions";

export function NotificationPreferencesForm({
  notifyOnComments,
  notifyOnMentions,
  notifyOnReactions,
  notifyOnCheckIns,
}: {
  notifyOnComments: boolean;
  notifyOnMentions: boolean;
  notifyOnReactions: boolean;
  notifyOnCheckIns: boolean;
}) {
  const [state, action, pending] = useActionState(updateNotificationPreferences, undefined);
  const markSubmitted = useActionToast(state, pending, "Notification preferences saved");

  return (
    <form
      action={(formData) => {
        markSubmitted();
        action(formData);
      }}
      className="flex flex-col gap-2"
    >
      <p className="text-xs text-foreground-tertiary">
        Turns off push and email for these — the notification bell still shows them either way.
      </p>
      <Switch id="notifyOnComments" name="notifyOnComments" label="Comments" defaultChecked={notifyOnComments} />
      <Switch id="notifyOnMentions" name="notifyOnMentions" label="Mentions" defaultChecked={notifyOnMentions} />
      <Switch id="notifyOnReactions" name="notifyOnReactions" label="Reactions" defaultChecked={notifyOnReactions} />
      <Switch id="notifyOnCheckIns" name="notifyOnCheckIns" label="Check-ins" defaultChecked={notifyOnCheckIns} />
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Saving..." : "Save preferences"}
      </Button>
    </form>
  );
}

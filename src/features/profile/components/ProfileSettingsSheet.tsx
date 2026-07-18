"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { GoalsForm } from "@/features/goals/components/GoalsForm";
import { NotificationPreferencesForm, PushNotificationManager } from "@/features/notifications";
import { ProfileDetailsForm } from "./ProfileDetailsForm";
import type { Gender, UnitsPreference } from "../types";

// Moved wholesale from the old inline 3-tab Profile page into a sheet behind an "Edit profile"
// trigger — same components, same props, just a different container. Self-contained trigger +
// sheet, same shape as ClanSwitcher.
export function ProfileSettingsSheet({
  gymTarget,
  stepsTarget,
  age,
  bmi,
  heightDisplay,
  weightDisplay,
  dateOfBirth,
  gender,
  unitsPreference,
  bio,
  notificationPreferences,
}: {
  gymTarget?: number;
  stepsTarget?: number;
  age?: number;
  bmi?: number;
  heightDisplay?: number;
  weightDisplay?: number;
  dateOfBirth?: string;
  gender?: Gender;
  unitsPreference: UnitsPreference;
  bio?: string;
  notificationPreferences: {
    notifyOnComments: boolean;
    notifyOnMentions: boolean;
    notifyOnReactions: boolean;
    notifyOnCheckIns: boolean;
  };
}) {
  const [open, setOpen] = useState(false);

  const tabs: TabItem[] = [
    {
      id: "goals",
      label: "Goals",
      content: <GoalsForm gymTarget={gymTarget} stepsTarget={stepsTarget} />,
    },
    {
      id: "details",
      label: "Details",
      content: (
        <>
          <p className="text-xs text-foreground-tertiary">Only visible to you.</p>
          {(age !== undefined || bmi !== undefined) && (
            <p className="text-sm text-foreground-secondary">
              {age !== undefined && <>Age {age}</>}
              {age !== undefined && bmi !== undefined && " · "}
              {bmi !== undefined && <>BMI {bmi.toFixed(1)}</>}
            </p>
          )}
          <ProfileDetailsForm
            key={[heightDisplay, weightDisplay, dateOfBirth, gender, unitsPreference, bio].join("|")}
            heightDisplay={heightDisplay}
            weightDisplay={weightDisplay}
            dateOfBirth={dateOfBirth}
            gender={gender}
            unitsPreference={unitsPreference}
            bio={bio}
          />
        </>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      content: (
        <>
          <PushNotificationManager />
          <hr className="border-surface-border" />
          <NotificationPreferencesForm {...notificationPreferences} />
        </>
      ),
    },
  ];

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Edit profile
      </Button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Edit profile">
        <Tabs tabs={tabs} />
      </BottomSheet>
    </>
  );
}

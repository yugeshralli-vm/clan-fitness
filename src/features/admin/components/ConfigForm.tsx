"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateAppConfig } from "../actions";
import type { ConfigKey } from "../config";

const FIELDS: { key: ConfigKey; label: string; step?: string }[] = [
  { key: "stepWeight", label: "Step weight (0–1)", step: "0.01" },
  { key: "streakWeight", label: "Streak weight (0–1)", step: "0.01" },
  { key: "gymWeight", label: "Gym weight (0–1)", step: "0.01" },
  { key: "streakCapDays", label: "Streak cap (days)" },
  { key: "defaultWeeklyGymTarget", label: "Default gym target (days/week)" },
  { key: "defaultDailyStepsTarget", label: "Default steps target (per day)" },
];

export function ConfigForm({ config }: { config: Record<ConfigKey, number> }) {
  const [state, formAction, pending] = useActionState(updateAppConfig, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-xs text-foreground-tertiary">
        Step, streak, and gym weights should add up to 1. Takes effect immediately on every
        clan&apos;s leaderboard — no deploy needed.
      </p>
      {FIELDS.map((field) => (
        <div key={field.key} className="flex flex-col gap-1">
          <label htmlFor={field.key} className="text-sm font-medium text-foreground">
            {field.label}
          </label>
          <Input
            id={field.key}
            name={field.key}
            type="number"
            step={field.step ?? "1"}
            defaultValue={config[field.key]}
            required
          />
        </div>
      ))}
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save settings"}
      </Button>
    </form>
  );
}

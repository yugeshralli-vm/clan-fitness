"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfileDetails } from "../actions";
import type { Gender, UnitsPreference } from "../types";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "prefer_not_to_say", label: "Prefer not to say" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

const SELECT_CLASS =
  "rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-base text-foreground sm:text-sm";

export function ProfileDetailsForm({
  heightDisplay,
  weightDisplay,
  dateOfBirth,
  gender,
  unitsPreference,
  bio,
}: {
  heightDisplay?: number;
  weightDisplay?: number;
  dateOfBirth?: string;
  gender?: Gender;
  unitsPreference: UnitsPreference;
  bio?: string;
}) {
  const [state, action, pending] = useActionState(updateProfileDetails, undefined);
  const [units, setUnits] = useState<UnitsPreference>(unitsPreference);

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="unitsPreference" className="text-sm font-medium text-foreground">
          Units
        </label>
        <select
          id="unitsPreference"
          name="unitsPreference"
          value={units}
          onChange={(event) => setUnits(event.target.value as UnitsPreference)}
          className={SELECT_CLASS}
        >
          <option value="metric">Metric (cm, kg)</option>
          <option value="imperial">Imperial (in, lb)</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="height" className="text-sm font-medium text-foreground">
          Height ({units === "metric" ? "cm" : "in"})
        </label>
        <Input id="height" name="height" type="number" min={0} step="0.1" defaultValue={heightDisplay} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="weight" className="text-sm font-medium text-foreground">
          Weight ({units === "metric" ? "kg" : "lb"})
        </label>
        <Input id="weight" name="weight" type="number" min={0} step="0.1" defaultValue={weightDisplay} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="dateOfBirth" className="text-sm font-medium text-foreground">
          Date of birth
        </label>
        <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={dateOfBirth} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="gender" className="text-sm font-medium text-foreground">
          Gender
        </label>
        <select id="gender" name="gender" defaultValue={gender ?? "prefer_not_to_say"} className={SELECT_CLASS}>
          {GENDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="bio" className="text-sm font-medium text-foreground">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          maxLength={200}
          rows={3}
          defaultValue={bio}
          placeholder="A short intro for your clan"
          className="rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-base text-foreground placeholder:text-foreground-muted sm:text-sm"
        />
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save details"}
      </Button>
    </form>
  );
}

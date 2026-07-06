import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserGoals, GoalsForm } from "@/features/goals";
import { calculateAge, calculateBmi, getProfileDetails, ProfileDetailsForm } from "@/features/profile";

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.453592;

export default async function ProfilePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [goals, details] = await Promise.all([getUserGoals(userId), getProfileDetails(userId)]);
  const gymGoal = goals.find((g) => g.type === "gym");
  const stepsGoal = goals.find((g) => g.type === "steps");

  const unitsPreference = details?.unitsPreference ?? "metric";
  const heightCm = details?.heightCm ?? undefined;
  const weightKg = details?.weightKg ? Number(details.weightKg) : undefined;
  const heightDisplay =
    heightCm === undefined
      ? undefined
      : unitsPreference === "imperial"
        ? Math.round(heightCm / CM_PER_INCH)
        : heightCm;
  const weightDisplay =
    weightKg === undefined
      ? undefined
      : unitsPreference === "imperial"
        ? Math.round(weightKg / KG_PER_LB)
        : weightKg;

  const age = details?.dateOfBirth ? calculateAge(details.dateOfBirth) : undefined;
  const bmi = heightCm && weightKg ? calculateBmi(heightCm, weightKg) : undefined;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 px-6 py-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>

        <section className="flex flex-col gap-4">
          <h2 className="font-semibold text-foreground">Goals</h2>
          <GoalsForm gymTarget={gymGoal?.targetValue} stepsTarget={stepsGoal?.targetValue} />
        </section>
      </div>

      <section className="flex flex-col gap-4 border-t border-surface-border pt-8">
        <div>
          <h2 className="font-semibold text-foreground">Your details</h2>
          <p className="text-xs text-foreground-tertiary">Only visible to you.</p>
        </div>
        {(age !== undefined || bmi !== undefined) && (
          <p className="text-sm text-foreground-secondary">
            {age !== undefined && <>Age {age}</>}
            {age !== undefined && bmi !== undefined && " · "}
            {bmi !== undefined && <>BMI {bmi.toFixed(1)}</>}
          </p>
        )}
        <ProfileDetailsForm
          heightDisplay={heightDisplay}
          weightDisplay={weightDisplay}
          dateOfBirth={details?.dateOfBirth ?? undefined}
          gender={details?.gender ?? undefined}
          unitsPreference={unitsPreference}
          bio={details?.bio ?? undefined}
        />
      </section>
    </div>
  );
}

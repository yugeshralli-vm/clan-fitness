import { NextResponse } from "next/server";
import { setGoals } from "@/features/goals/actions";
import { apiError, requireApiUser } from "@/lib/api-response";

/** PUT /api/v1/me/goals { gymDaysPerWeek, stepsPerDay } — the web goals form, through its server action. */
export async function PUT(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const body = (await request.json().catch(() => null)) as { gymDaysPerWeek?: number; stepsPerDay?: number } | null;
  if (!body) return apiError(400, "Invalid request body.");

  const formData = new FormData();
  formData.set("daysPerWeek", String(body.gymDaysPerWeek ?? ""));
  formData.set("stepsPerDay", String(body.stepsPerDay ?? ""));
  const result = await setGoals(undefined, formData);
  if (result?.error) return apiError(400, result.error);
  return NextResponse.json({ goals: { gymDaysPerWeek: body.gymDaysPerWeek, stepsPerDay: body.stepsPerDay } });
}

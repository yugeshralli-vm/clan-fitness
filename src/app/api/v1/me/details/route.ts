import { NextResponse } from "next/server";
import { updateProfileDetails } from "@/features/profile/actions";
import { apiError, requireApiUser } from "@/lib/api-response";

type DetailsBody = {
  unitsPreference?: "metric" | "imperial";
  height?: number | null;
  weight?: number | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bio?: string | null;
};

/**
 * PUT /api/v1/me/details — the web "Details" settings form, through its server action. Replaces
 * every field, like the form does (missing or null clears it). Height and weight are in the units
 * of `unitsPreference` (in/lb or cm/kg); dateOfBirth is YYYY-MM-DD.
 */
export async function PUT(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const body = (await request.json().catch(() => null)) as DetailsBody | null;
  if (!body) return apiError(400, "Invalid request body.");

  const formData = new FormData();
  formData.set("unitsPreference", body.unitsPreference === "imperial" ? "imperial" : "metric");
  formData.set("height", body.height == null ? "" : String(body.height));
  formData.set("weight", body.weight == null ? "" : String(body.weight));
  formData.set("dateOfBirth", body.dateOfBirth ?? "");
  formData.set("gender", body.gender ?? "");
  formData.set("bio", body.bio ?? "");
  const result = await updateProfileDetails(undefined, formData);
  if (result?.error) return apiError(400, result.error);
  return NextResponse.json({ saved: true });
}

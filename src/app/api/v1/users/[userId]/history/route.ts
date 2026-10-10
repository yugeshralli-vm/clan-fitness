import { NextResponse } from "next/server";
import { getFilteredHistoryForUser, type HistoryRange } from "@/features/check-ins/history-actions";
import type { CheckInType } from "@/features/check-ins/types";
import { toApiHistory } from "@/lib/api-history";
import { apiError, requireApiUser } from "@/lib/api-response";

const TYPES: readonly (CheckInType | "all")[] = ["all", "gym", "steps", "food", "thought"];
const RANGES: readonly HistoryRange[] = ["7d", "30d", "90d", "all"];

/**
 * GET /api/v1/users/:userId/history?type=all|gym|steps|food|thought&range=7d|30d|90d|all&before=ISO
 * — a profile's history filters and "Load more", through the web's own history action (which
 * allows yourself or a clanmate). `before` is the oldest loaded entry's createdAt.
 */
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const { userId } = await params;
  const search = new URL(request.url).searchParams;
  const type = (search.get("type") ?? "all") as CheckInType | "all";
  const range = (search.get("range") ?? "30d") as HistoryRange;
  const before = search.get("before") ?? undefined;
  if (!TYPES.includes(type)) return apiError(400, "Invalid type.");
  if (!RANGES.includes(range)) return apiError(400, "Invalid range.");
  if (before && Number.isNaN(new Date(before).getTime())) return apiError(400, "Invalid before cursor.");

  try {
    return NextResponse.json(toApiHistory(await getFilteredHistoryForUser(userId, type, range, before)));
  } catch {
    // The action throws when the viewer isn't allowed to see this user.
    return apiError(404, "Not found.");
  }
}

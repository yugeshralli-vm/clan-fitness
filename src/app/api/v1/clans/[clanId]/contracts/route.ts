import { NextResponse } from "next/server";
import { getAppConfig } from "@/features/admin/config";
import { claimContract, fetchContractBoard, getLiveClaimProgress } from "@/features/clan-contracts/actions";
import { apiError, requireApiUser } from "@/lib/api-response";
import { requireClanMember } from "@/lib/api-membership";

type Params = { params: Promise<{ clanId: string }> };

/**
 * GET /api/v1/clans/:clanId/contracts — today's contract board (web /clans/:id/contracts): every
 * contract with today's claim if any, the daily claim cap, and the live check of today's open
 * claims (`completed` before the nightly resolution, for the "done" state and celebrations).
 * The clan day runs on IST, like the web.
 */
export async function GET(_request: Request, { params }: Params) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const { clanId } = await params;
  const m = await requireClanMember(r.user.id, clanId);
  if ("error" in m) return m.error;

  const [board, liveProgress, config] = await Promise.all([fetchContractBoard(clanId), getLiveClaimProgress(clanId), getAppConfig()]);
  return NextResponse.json({ board, liveProgress, maxClaimsPerMemberPerDay: config.maxClaimsPerMemberPerDay });
}

/** POST /api/v1/clans/:clanId/contracts { contractId } — claim a contract for today, through the web's action. */
export async function POST(request: Request, { params }: Params) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const { clanId } = await params;
  const body = (await request.json().catch(() => null)) as { contractId?: string } | null;
  if (!body?.contractId) return apiError(400, "contractId is required.");

  const result = await claimContract(clanId, body.contractId);
  if ("error" in result) return apiError(result.error === "Not authorized." ? 403 : 400, result.error);
  return NextResponse.json(result);
}

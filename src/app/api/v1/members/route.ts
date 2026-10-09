import { NextResponse } from "next/server";
import { getAppConfig } from "@/features/admin/config";
import { levelForPoints } from "@/features/clan-contracts/level";
import { getClanMembers } from "@/features/clans/queries";
import { requireApiUser } from "@/lib/api-response";
import { requireClanMember } from "@/lib/api-membership";

/** GET /api/v1/members?clanId= — the clan's members, for @mention suggestions and member lists. */
export async function GET(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const clanId = new URL(request.url).searchParams.get("clanId");
  const m = await requireClanMember(r.user.id, clanId);
  if ("error" in m) return m.error;

  const [members, config] = await Promise.all([getClanMembers(clanId!), getAppConfig()]);
  return NextResponse.json({
    members: members.map((member) => ({
      id: member.user.id,
      name: member.user.name,
      avatarUrl: member.user.avatarUrl,
      level: levelForPoints(member.user.totalPoints, config),
      role: member.role,
    })),
  });
}

import { NextResponse } from "next/server";
import { getClanMemberCount, getUserClans } from "@/features/clans/queries";
import { requireApiUser } from "@/lib/api-response";

export async function GET() {
  const r = await requireApiUser();
  if ("error" in r) return r.error;

  const memberships = await getUserClans(r.user.id);
  // The feed header shows "24/25 members"; a user is only ever in a handful of clans.
  const memberCounts = await Promise.all(memberships.map((m) => getClanMemberCount(m.clan.id)));
  return NextResponse.json({
    clans: memberships.map((m, i) => ({
      id: m.clan.id,
      name: m.clan.name,
      description: m.clan.description,
      imageUrl: m.clan.imageUrl,
      role: m.role,
      memberCount: memberCounts[i],
      maxSize: m.clan.maxSize,
    })),
  });
}

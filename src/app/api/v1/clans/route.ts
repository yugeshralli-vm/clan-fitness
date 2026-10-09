import { NextResponse } from "next/server";
import { getUserClans } from "@/features/clans/queries";
import { requireApiUser } from "@/lib/api-response";

export async function GET() {
  const r = await requireApiUser();
  if ("error" in r) return r.error;

  const memberships = await getUserClans(r.user.id);
  return NextResponse.json({
    clans: memberships.map((m) => ({
      id: m.clan.id,
      name: m.clan.name,
      imageUrl: m.clan.imageUrl,
      role: m.role,
    })),
  });
}

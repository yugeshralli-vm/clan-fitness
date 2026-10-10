import { NextResponse } from "next/server";
import { createClanFor } from "@/features/clans/mutations";
import { getClanMemberCount, getUserClans } from "@/features/clans/queries";
import { apiError, requireApiUser } from "@/lib/api-response";

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

/**
 * POST /api/v1/clans { name, description? } — create a clan with you as its admin (web /clans/new).
 * Returns its id; the web then shows the welcome page (set goals, share the invite).
 */
export async function POST(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const body = (await request.json().catch(() => null)) as { name?: string; description?: string } | null;
  if (!body) return apiError(400, "Invalid request body.");

  const result = await createClanFor(r.user.id, body.name ?? "", body.description ?? "");
  if ("error" in result) return apiError(400, result.error);
  return NextResponse.json(result, { status: 201 });
}

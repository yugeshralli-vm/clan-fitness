import { NextResponse } from "next/server";
import { getAppConfig } from "@/features/admin/config";
import {
  computeLeaderboard,
  daysInMonth,
  getUsersLoggedToday,
  startOfMonth,
  startOfToday,
  startOfYesterday,
  type LeaderboardEntry,
} from "@/features/check-ins";
import { levelForPoints } from "@/features/clan-contracts/level";
import { deleteClanFor, renameClanFor } from "@/features/clans/mutations";
import { getClanById, getClanMembers } from "@/features/clans/queries";
import { getGoalsForUsers } from "@/features/goals";
import { apiError, requireApiUser } from "@/lib/api-response";
import { startOfUserWeek } from "@/lib/timezone-date";

type Params = { params: Promise<{ clanId: string }> };

function toApiEntry(entry: LeaderboardEntry) {
  const { user, ...stats } = entry;
  return { user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl }, ...stats };
}

/**
 * GET /api/v1/clans/:clanId — the web clan page (/clans/:id/manage): the clan, your role, members
 * (level, role, whether they've logged today in your day — for "Not logged yet" and nudges) and
 * the Today/Yesterday/Week/Month leaderboards, computed exactly as the web page does. The invite
 * code is included for the admin only.
 */
export async function GET(_request: Request, { params }: Params) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const { clanId } = await params;

  const [clan, members, config] = await Promise.all([getClanById(clanId), getClanMembers(clanId), getAppConfig()]);
  const membership = members.find((m) => m.user.id === r.user.id);
  if (!clan || !membership) return apiError(404, "Not found.");

  const viewerTimezone = membership.user.timezone;
  const memberIds = members.map((m) => m.user.id);
  const [loggedToday, gymGoals, stepsGoals] = await Promise.all([
    getUsersLoggedToday(memberIds, viewerTimezone),
    getGoalsForUsers(memberIds, "gym"),
    getGoalsForUsers(memberIds, "steps"),
  ]);

  // One `now` for every window, like the web page — see its comment on streak consistency.
  const now = new Date();
  const [today, yesterday, week, month] = await Promise.all([
    computeLeaderboard(members, config, stepsGoals, gymGoals, { start: startOfToday(viewerTimezone, now), end: now }, 1),
    computeLeaderboard(
      members,
      config,
      stepsGoals,
      gymGoals,
      { start: startOfYesterday(viewerTimezone, now), end: startOfToday(viewerTimezone, now) },
      1,
    ),
    computeLeaderboard(members, config, stepsGoals, gymGoals, { start: startOfUserWeek(viewerTimezone, now), end: now }, 7),
    computeLeaderboard(
      members,
      config,
      stepsGoals,
      gymGoals,
      { start: startOfMonth(viewerTimezone, now), end: now },
      daysInMonth(viewerTimezone, now),
    ),
  ]);

  const isAdmin = membership.role === "admin";
  return NextResponse.json({
    clan: {
      id: clan.id,
      name: clan.name,
      description: clan.description,
      memberCount: members.length,
      maxSize: clan.maxSize,
      inviteCode: isAdmin ? clan.inviteCode : null,
    },
    role: membership.role,
    members: members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
      level: levelForPoints(m.user.totalPoints, config),
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      loggedToday: loggedToday.has(m.user.id),
    })),
    leaderboards: {
      today: today.map(toApiEntry),
      yesterday: yesterday.map(toApiEntry),
      week: week.map(toApiEntry),
      month: month.map(toApiEntry),
    },
  });
}

/** PATCH /api/v1/clans/:clanId { name } — rename (admin only). */
export async function PATCH(request: Request, { params }: Params) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const { clanId } = await params;
  const body = (await request.json().catch(() => null)) as { name?: string } | null;

  const result = await renameClanFor(r.user.id, clanId, body?.name ?? "");
  if ("error" in result) return apiError(400, result.error);
  return NextResponse.json(result);
}

/** DELETE /api/v1/clans/:clanId { confirmName } — delete the clan and everything in it (admin only; type the exact name). */
export async function DELETE(request: Request, { params }: Params) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const { clanId } = await params;
  const body = (await request.json().catch(() => null)) as { confirmName?: string } | null;

  const result = await deleteClanFor(r.user.id, clanId, body?.confirmName ?? "");
  if ("error" in result) return apiError(400, result.error);
  return new NextResponse(null, { status: 204 });
}

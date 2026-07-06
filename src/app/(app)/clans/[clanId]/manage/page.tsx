import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/components/shared/Avatar";
import { getStreaks, getUsersLoggedToday, getWeeklyCounts } from "@/features/check-ins";
import { ClanSettingsSheet, getClanById, getClanMembers, getClanMembership, MemberActionsSheet } from "@/features/clans";
import { getGoalsForUsers } from "@/features/goals";

const DEFAULT_WEEKLY_GYM_TARGET = 4;

export default async function ManageClanPage({ params }: { params: Promise<{ clanId: string }> }) {
  const { clanId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [clan, membership, members] = await Promise.all([
    getClanById(clanId),
    getClanMembership(userId, clanId),
    getClanMembers(clanId),
  ]);
  if (!clan || !membership) notFound();

  const memberIds = members.map((m) => m.user.id);
  const [loggedToday, weeklyCounts, streaks, gymGoals] = await Promise.all([
    getUsersLoggedToday(memberIds),
    getWeeklyCounts(memberIds, "gym"),
    getStreaks(memberIds, "gym"),
    getGoalsForUsers(memberIds, "gym"),
  ]);
  const isAdmin = membership.role === "admin";

  const leaderboard = members
    .map(({ user }) => ({
      user,
      weeklyCount: weeklyCounts.get(user.id) ?? 0,
      weeklyTarget: gymGoals.get(user.id) ?? DEFAULT_WEEKLY_GYM_TARGET,
      streak: streaks.get(user.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.weeklyCount - a.weeklyCount || b.streak - a.streak || a.user.name.localeCompare(b.user.name),
    );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-foreground">{clan.name}</h1>
          <p className="text-sm text-foreground-tertiary">
            {members.length}/{clan.maxSize} members
          </p>
        </div>
        {isAdmin && (
          <div className="shrink-0">
            <ClanSettingsSheet clanId={clanId} clanName={clan.name} inviteCode={clan.inviteCode} />
          </div>
        )}
      </div>

      <section className="flex flex-col gap-1 rounded-xl border border-surface-border bg-surface p-5">
        <h2 className="mb-2 font-semibold text-foreground">This week</h2>
        <ul className="flex flex-col divide-y divide-surface-border">
          {leaderboard.map(({ user, weeklyCount, weeklyTarget, streak }) => (
            <li key={user.id} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Avatar src={user.avatarUrl} name={user.name} />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{user.name}</span>
              <span className="shrink-0 text-sm text-foreground-secondary">
                {weeklyCount}/{weeklyTarget} <span className="text-foreground-tertiary">gym</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-ember">{streak}🔥</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-1 rounded-xl border border-surface-border bg-surface p-5">
        <h2 className="mb-2 font-semibold text-foreground">Members</h2>
        <ul className="flex flex-col divide-y divide-surface-border">
          {members.map(({ user, role }) => (
            <li key={user.id} className="py-3 first:pt-0 last:pb-0">
              {isAdmin && role !== "admin" ? (
                <MemberActionsSheet
                  clanId={clanId}
                  memberUserId={user.id}
                  memberName={user.name}
                  memberAvatarUrl={user.avatarUrl}
                  loggedToday={loggedToday.has(user.id)}
                />
              ) : (
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar src={user.avatarUrl} name={user.name} />
                  <div className="min-w-0 flex-1">
                    <p className="min-w-0 truncate text-sm text-foreground">
                      {user.name}
                      {role === "admin" && (
                        <span className="ml-2 rounded bg-background px-1.5 py-0.5 text-xs text-foreground-tertiary">
                          Admin
                        </span>
                      )}
                    </p>
                    <p
                      className={`text-xs ${
                        loggedToday.has(user.id) ? "text-foreground-tertiary" : "text-danger"
                      }`}
                    >
                      {loggedToday.has(user.id) ? "Logged today" : "Not logged yet"}
                    </p>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { getAppConfig } from "@/features/admin";
import { computeLeaderboard, getUsersLoggedToday, startOfWeek } from "@/features/check-ins";
import {
  ClanLeaderboardSection,
  ClanMembersSection,
  ClanSettingsSheet,
  getClanById,
  getClanMembers,
} from "@/features/clans";
import { getGoalsForUsers } from "@/features/goals";

export default async function ManageClanPage({ params }: { params: Promise<{ clanId: string }> }) {
  const { clanId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // members already contains the current user's own row (with role), so a separate
  // getClanMembership call for the same table would be a redundant query.
  const [clan, members, config] = await Promise.all([
    getClanById(clanId),
    getClanMembers(clanId),
    getAppConfig(),
  ]);
  const membership = members.find((m) => m.user.id === userId);
  if (!clan || !membership) notFound();

  const memberIds = members.map((m) => m.user.id);
  const [loggedToday, gymGoals, stepsGoals] = await Promise.all([
    getUsersLoggedToday(memberIds),
    getGoalsForUsers(memberIds, "gym"),
    getGoalsForUsers(memberIds, "steps"),
  ]);
  const isAdmin = membership.role === "admin";

  // Gym turnout is low across most clans, so gym only gets a minority weight rather than being
  // dropped outright: % of weekly steps goal (50%), a streak of days the steps *goal* was
  // actually hit rather than just logged, capped at 7 days (25%), and % of weekly gym goal (25%).
  // All of these — the three weights, the streak cap, and the two defaults below — are
  // admin-tunable from /admin without a deploy (see src/features/admin/config.ts). The formula
  // itself lives in computeLeaderboard so the weekly recap cron job scores past weeks identically.
  const leaderboard = await computeLeaderboard(members, config, stepsGoals, gymGoals, {
    start: startOfWeek(),
  });

  const tabs: TabItem[] = [
    { id: "leaderboard", label: "Leaderboard", content: <ClanLeaderboardSection leaderboard={leaderboard} /> },
    {
      id: "members",
      label: "Members",
      content: (
        <ClanMembersSection
          clanId={clanId}
          members={members}
          isAdmin={isAdmin}
          currentUserId={userId}
          loggedToday={loggedToday}
        />
      ),
    },
  ];

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
            <ClanSettingsSheet
              clanId={clanId}
              clanName={clan.name}
              inviteCode={clan.inviteCode}
              memberCount={members.length}
            />
          </div>
        )}
      </div>

      <Tabs tabs={tabs} />
    </div>
  );
}

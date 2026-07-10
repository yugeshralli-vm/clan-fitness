import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { ClanWelcomeActions, getClanById, getClanMembership } from "@/features/clans";
import { getUserGoals } from "@/features/goals";

export default async function ClanWelcomePage({
  params,
}: {
  params: Promise<{ clanId: string }>;
}) {
  const { clanId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const membership = await getClanMembership(userId, clanId);
  if (!membership) notFound();

  const [clan, existingGoals] = await Promise.all([getClanById(clanId), getUserGoals(userId)]);
  if (!clan) notFound();

  const hasGoals = existingGoals.length > 0;

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Welcome to {clan.name}! 🎉</h1>
        <p className="text-foreground-secondary">
          You&apos;re in. Log your first gym session, steps, or a meal photo — your clan&apos;s
          about to see it in the feed.
        </p>
      </div>

      {hasGoals ? (
        <ClanWelcomeActions clanId={clanId} mode="continue" />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface p-5">
          <div>
            <h2 className="font-semibold text-foreground">Set your targets</h2>
            <p className="text-sm text-foreground-tertiary">
              This is what your clan&apos;s leaderboard scores against — you can change it anytime
              in your profile.
            </p>
          </div>
          <ClanWelcomeActions clanId={clanId} mode="goals" />
        </div>
      )}
    </main>
  );
}

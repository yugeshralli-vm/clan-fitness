import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav, type FeedCheckInEntry } from "@/components/shared/BottomNav";
import { ClanSwitcher } from "@/components/shared/ClanSwitcher";
import { FeedbackFab } from "@/components/shared/FeedbackFab";
import { InstallPrompt } from "@/components/shared/InstallPrompt";
import { PullToRefresh } from "@/components/shared/PullToRefresh";
import { getLatestCheckInAt } from "@/features/check-ins";
import { getUserClans } from "@/features/clans";
import { AutoEnableNotifications, NotificationBell } from "@/features/notifications";
import { getUnreadNotificationCount } from "@/features/notifications/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const memberships = await getUserClans(userId);
  if (memberships.length === 0) redirect("/onboarding");

  const clans = memberships.map((m) => m.clan);

  // Neither of these is needed for {children} or BottomNav's actual nav links to render — both
  // only feed a small decoration (an unread-feed dot, a notification badge count). Deliberately
  // NOT awaited here: the still-pending promises are handed straight to BottomNav/NotificationBell,
  // which unwrap them with use() inside their own small Suspense boundaries, so page content and
  // navigation stream immediately instead of blocking on these DB round-trips. .catch() fallbacks
  // guard against an unhandled rejection taking down an already-streamed page (this app has no
  // error.tsx boundary).
  const latestFeedCheckInAtByClan: Promise<FeedCheckInEntry[]> = Promise.all(
    clans.map(async (clan) => ({
      clanId: clan.id,
      latestCheckInAt: await getLatestCheckInAt(clan.id, userId),
    })),
  ).catch((): FeedCheckInEntry[] => clans.map((clan) => ({ clanId: clan.id, latestCheckInAt: null })));

  const initialUnreadCount: Promise<number> = getUnreadNotificationCount(userId).catch(() => 0);

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="fixed inset-x-0 top-0 z-10 border-b border-surface-border bg-surface pt-[env(safe-area-inset-top)]">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/logs"
            className="shrink-0 font-sans text-lg font-bold tracking-tight text-foreground"
          >
            Clan <span className="text-accent">Fitness</span>
          </Link>
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <ClanSwitcher clans={clans} />
            <NotificationBell initialUnreadCount={initialUnreadCount} />
            <UserButton />
          </div>
        </div>
      </header>
      <main className="flex-1 pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
        <PullToRefresh>{children}</PullToRefresh>
      </main>
      <BottomNav clans={clans} latestFeedCheckInAtByClan={latestFeedCheckInAtByClan} />
      <AutoEnableNotifications />
      <InstallPrompt />
      <FeedbackFab userId={userId} />
    </div>
  );
}

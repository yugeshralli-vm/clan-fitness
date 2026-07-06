import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/shared/BottomNav";
import { ClanSwitcher } from "@/components/shared/ClanSwitcher";
import { getUserClans } from "@/features/clans";
import { getUserGoals } from "@/features/goals";
import { AutoEnableNotifications } from "@/features/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [memberships, goals] = await Promise.all([getUserClans(userId), getUserGoals(userId)]);
  if (memberships.length === 0) redirect("/onboarding");
  if (goals.length === 0) redirect("/onboarding/goals");

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
            <ClanSwitcher clans={memberships.map((m) => m.clan)} />
            <UserButton />
          </div>
        </div>
      </header>
      <main className="flex-1 pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
        {children}
      </main>
      <BottomNav clanId={memberships[0]?.clan.id} />
      <AutoEnableNotifications />
    </div>
  );
}

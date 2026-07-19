import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppConfig } from "@/features/admin/config";
import { ContractsBoard } from "@/features/clan-contracts/components/ContractsBoard";
import { getContractBoard } from "@/features/clan-contracts/queries";
import { getClanById, getClanMembers } from "@/features/clans";
import { getOrSyncCurrentUser } from "@/lib/current-user";
import { userDayKey } from "@/lib/timezone-date";

export default async function ClanContractsPage({ params }: { params: Promise<{ clanId: string }> }) {
  const { clanId } = await params;
  const user = await getOrSyncCurrentUser();
  if (!user) redirect("/sign-in");

  const [clan, members] = await Promise.all([getClanById(clanId), getClanMembers(clanId)]);
  const isMember = members.some((m) => m.user.id === user.id);
  if (!clan || !isMember) notFound();

  const dayKey = userDayKey("Asia/Kolkata", new Date());
  const [board, config] = await Promise.all([getContractBoard(clanId, dayKey, user.id), getAppConfig()]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <Link href={`/clans/${clanId}/manage`} aria-label="Back to clan" className="text-foreground-secondary">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">{clan.name} contracts</h1>
      </div>
      <p className="text-sm text-foreground-tertiary">
        Claim a contract to earn points — each one can only be claimed by one member per day.
      </p>
      <ContractsBoard
        clanId={clanId}
        initialBoard={board}
        currentUserId={user.id}
        maxClaimsPerMemberPerDay={config.maxClaimsPerMemberPerDay}
      />
    </div>
  );
}

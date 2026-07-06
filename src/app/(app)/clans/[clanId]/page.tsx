import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getClanById, getClanMemberCount, getClanMembership } from "@/features/clans";
import { ClanFeed } from "@/features/feed";

export default async function ClanPage({ params }: { params: Promise<{ clanId: string }> }) {
  const { clanId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [clan, membership, memberCount] = await Promise.all([
    getClanById(clanId),
    getClanMembership(userId, clanId),
    getClanMemberCount(clanId),
  ]);
  if (!clan || !membership) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{clan.name}</h1>
        {clan.description && <p className="text-foreground-secondary">{clan.description}</p>}
        <p className="text-sm text-foreground-tertiary">
          {memberCount}/{clan.maxSize} members
        </p>
      </div>
      <ClanFeed clanId={clanId} />
    </div>
  );
}

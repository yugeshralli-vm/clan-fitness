import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getClanById, getClanMembers } from "@/features/clans";
import { ClanFeed } from "@/features/feed";

export default async function ClanPage({
  params,
  searchParams,
}: {
  params: Promise<{ clanId: string }>;
  searchParams: Promise<{ checkIn?: string }>;
}) {
  const { clanId } = await params;
  const { checkIn } = await searchParams;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Fetching the full member list once here (instead of a separate membership-existence check +
  // a separate count) lets ClanFeed below reuse it instead of querying clan_memberships again.
  const [clan, members] = await Promise.all([getClanById(clanId), getClanMembers(clanId)]);
  const isMember = members.some((m) => m.user.id === userId);
  if (!clan || !isMember) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{clan.name}</h1>
        {clan.description && <p className="text-foreground-secondary">{clan.description}</p>}
        <p className="text-sm text-foreground-tertiary">
          {members.length}/{clan.maxSize} members
        </p>
      </div>
      <ClanFeed clanId={clanId} highlightCheckInId={checkIn} members={members} />
    </div>
  );
}

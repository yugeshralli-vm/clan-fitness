import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppConfig } from "@/features/admin/config";
import { levelForPoints } from "@/features/clan-contracts/level";
import { getClanById, getClanMembers } from "@/features/clans";
import { ClanChatThread, getClanMessages } from "@/features/clan-chat";
import { getOrSyncCurrentUser } from "@/lib/current-user";

export default async function ClanChatPage({ params }: { params: Promise<{ clanId: string }> }) {
  const { clanId } = await params;
  const user = await getOrSyncCurrentUser();
  if (!user) redirect("/sign-in");

  // Same inline membership gate as the clan feed page itself.
  const [clan, members] = await Promise.all([getClanById(clanId), getClanMembers(clanId)]);
  const isMember = members.some((m) => m.user.id === user.id);
  if (!clan || !isMember) notFound();

  const [messages, config] = await Promise.all([getClanMessages(clanId, user.id), getAppConfig()]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-8">
      <div className="flex items-center gap-3">
        <Link href={`/clans/${clanId}`} aria-label="Back to clan" className="text-foreground-secondary">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">{clan.name} chat</h1>
      </div>
      <ClanChatThread
        clanId={clanId}
        currentUser={{
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          level: levelForPoints(user.totalPoints, config),
        }}
        members={members.map((m) => ({ id: m.user.id, name: m.user.name, avatarUrl: m.user.avatarUrl }))}
        initialMessages={messages}
      />
    </div>
  );
}

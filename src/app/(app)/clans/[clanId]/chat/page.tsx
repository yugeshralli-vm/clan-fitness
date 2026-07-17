import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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

  const messages = await getClanMessages(clanId);

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
        currentUser={{ id: user.id, name: user.name, avatarUrl: user.avatarUrl }}
        initialMessages={messages}
      />
    </div>
  );
}

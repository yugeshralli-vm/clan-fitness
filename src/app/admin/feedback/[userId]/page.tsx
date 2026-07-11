import { notFound } from "next/navigation";
import Link from "next/link";
import { ChatThread, getFeedbackThread } from "@/features/feedback";
import { getUserById } from "@/lib/current-user";

export default async function AdminFeedbackThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const [user, messages] = await Promise.all([getUserById(userId), getFeedbackThread(userId)]);
  if (!user) notFound();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <Link href="/admin" className="text-sm text-accent">
          ← Back to admin
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
        <p className="text-sm text-foreground-tertiary">{user.email}</p>
      </div>
      <ChatThread threadUserId={userId} viewerRole="admin" initialMessages={messages} />
    </div>
  );
}

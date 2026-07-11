import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ChatThread, getFeedbackThread } from "@/features/feedback";

export default async function FeedbackPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const messages = await getFeedbackThread(userId);

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-4 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Feedback</h1>
        <p className="text-sm text-foreground-tertiary">
          Bugs, ideas, anything — this goes straight to the team.
        </p>
      </div>
      <ChatThread threadUserId={userId} viewerRole="user" initialMessages={messages} />
    </div>
  );
}

import { MessageSquare } from "lucide-react";
import Link from "next/link";

// Only ever rendered on the clan feed page itself (see clans/[clanId]/page.tsx) — the chat page
// is a separate route file that doesn't render this, so it needs no pathname-based self-hiding.
export function ClanChatFab({ clanId }: { clanId: string }) {
  return (
    <Link
      href={`/clans/${clanId}/chat`}
      aria-label="Open clan chat"
      className="fixed bottom-20 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform active:scale-95 sm:bottom-6"
    >
      <MessageSquare size={22} />
    </Link>
  );
}

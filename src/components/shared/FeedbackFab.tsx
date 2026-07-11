"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function FeedbackFab() {
  const pathname = usePathname();
  if (pathname === "/feedback") return null;

  return (
    <Link
      href="/feedback"
      aria-label="Send feedback"
      className="fixed bottom-20 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform active:scale-95 sm:bottom-6"
    >
      <MessageSquare size={22} />
    </Link>
  );
}

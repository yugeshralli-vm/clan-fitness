"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoalsForm } from "@/features/goals";

export function ClanWelcomeActions({
  clanId,
  mode,
}: {
  clanId: string;
  mode: "goals" | "continue";
}) {
  const router = useRouter();

  if (mode === "continue") {
    return (
      <Link href={`/clans/${clanId}`} className="font-semibold text-accent">
        Continue to the feed →
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <GoalsForm onSuccess={() => router.push(`/clans/${clanId}`)} />
      <Link
        href={`/clans/${clanId}`}
        className="text-center text-sm text-foreground-tertiary hover:text-foreground"
      >
        Skip for now
      </Link>
    </div>
  );
}

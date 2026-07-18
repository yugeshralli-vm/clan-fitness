import { ChevronRight, ScrollText } from "lucide-react";
import Link from "next/link";

export function ContractsCard({ clanId }: { clanId: string }) {
  return (
    <Link
      href={`/clans/${clanId}/contracts`}
      className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface px-4 py-3"
    >
      <ScrollText size={20} className="shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">Contracts</p>
        <p className="text-xs text-foreground-tertiary">Claim a daily contract to earn points</p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-foreground-tertiary" />
    </Link>
  );
}

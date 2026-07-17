"use client";

import { ChevronDown, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { parseClanIdFromPathname, useActiveClanId, type ClanOption } from "@/lib/active-clan";

export function ClanSwitcher({ clans }: { clans: ClanOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const currentClanId = useActiveClanId(pathname, clans);

  if (clans.length === 0) return null;

  const currentClan = clans.find((c) => c.id === currentClanId) ?? clans[0];

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  // Preserve whichever clan-scoped tab (feed/chat/manage) is currently open instead of always
  // dropping back to the feed — only when the current page actually names a real clan, since a
  // clan-less page like /logs or /profile has no tab suffix to carry over.
  function goToClan(clanId: string) {
    const activeClanId = parseClanIdFromPathname(pathname);
    const suffix =
      activeClanId && clans.some((c) => c.id === activeClanId) ? pathname.slice(`/clans/${activeClanId}`.length) : "";
    go(`/clans/${clanId}${suffix}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 max-w-[40vw] items-center gap-1 text-sm font-semibold text-foreground sm:max-w-none"
      >
        <span className="truncate">{currentClan.name}</span>
        <ChevronDown size={16} className="shrink-0 text-foreground-tertiary" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Switch clan">
        <div className="flex flex-col gap-1">
          {clans.map((clan) => (
            <button
              key={clan.id}
              type="button"
              onClick={() => goToClan(clan.id)}
              className={`flex min-h-11 items-center rounded-lg px-3 text-left text-sm transition-colors ${
                clan.id === currentClanId
                  ? "bg-accent/10 font-semibold text-accent"
                  : "text-foreground hover:bg-background"
              }`}
            >
              {clan.name}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-1 border-t border-surface-border pt-4">
          <button
            type="button"
            onClick={() => go("/clans/new")}
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm text-foreground-secondary hover:bg-background"
          >
            <Plus size={16} />
            Create a clan
          </button>
          <button
            type="button"
            onClick={() => go("/clans/join")}
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm text-foreground-secondary hover:bg-background"
          >
            <Plus size={16} />
            Join with invite code
          </button>
        </div>
      </BottomSheet>
    </>
  );
}

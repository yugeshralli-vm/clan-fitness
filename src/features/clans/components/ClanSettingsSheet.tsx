"use client";

import { RefreshCw, Settings } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { regenerateInviteCode } from "../actions";
import { DeleteClanSection } from "./DeleteClanSection";
import { RenameClanForm } from "./RenameClanForm";
import { ShareInviteButton } from "./ShareInviteButton";

export function ClanSettingsSheet({
  clanId,
  clanName,
  inviteCode,
  memberCount,
}: {
  clanId: string;
  clanName: string;
  inviteCode: string;
  memberCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Clan settings"
        className="-m-2.5 p-2.5 text-foreground-tertiary hover:text-foreground"
      >
        <Settings size={20} />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Clan settings">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground-secondary">Invite people</h3>
            <p className="text-sm text-foreground-tertiary">
              Invite code: <span className="font-mono text-foreground">{inviteCode}</span>
            </p>
            <div className="flex items-center gap-2">
              <ShareInviteButton inviteCode={inviteCode} clanName={clanName} />
              <form action={regenerateInviteCode.bind(null, clanId)}>
                <Button
                  type="submit"
                  variant="secondary"
                  className="p-2.5!"
                  aria-label="Regenerate invite code"
                  title="Regenerate invite code"
                >
                  <RefreshCw size={16} />
                </Button>
              </form>
            </div>
            <p className="text-xs text-foreground-muted">
              Old links and codes stop working once you regenerate.
            </p>
          </section>

          <section className="flex flex-col gap-3 border-t border-surface-border pt-4">
            <h3 className="text-sm font-semibold text-foreground-secondary">Rename clan</h3>
            <RenameClanForm clanId={clanId} currentName={clanName} />
          </section>

          <section className="flex flex-col gap-3 border-t border-surface-border pt-4">
            <h3 className="text-sm font-semibold text-danger">Danger zone</h3>
            <DeleteClanSection clanId={clanId} clanName={clanName} memberCount={memberCount} />
          </section>
        </div>
      </BottomSheet>
    </>
  );
}

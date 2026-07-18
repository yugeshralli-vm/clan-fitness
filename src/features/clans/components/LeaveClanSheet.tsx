"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/shared/Avatar";
import { LevelBadge } from "@/components/shared/LevelBadge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { leaveClan } from "../actions";

// Shown only for the signed-in member's own row, and only when they aren't the clan's admin —
// admins can't leave (see leaveClan's guard), so their own row never renders this.
export function LeaveClanSheet({
  clanId,
  memberUserId,
  memberName,
  memberAvatarUrl,
  memberLevel,
  loggedToday,
}: {
  clanId: string;
  memberUserId: string;
  memberName: string;
  memberAvatarUrl?: string | null;
  memberLevel: number;
  loggedToday: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex w-full min-w-0 items-center gap-3">
        <Link href={`/members/${memberUserId}`} className="shrink-0">
          <Avatar src={memberAvatarUrl} name={memberName} />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5 truncate text-sm text-foreground">
              {memberName}
              <LevelBadge level={memberLevel} />
            </p>
            <p className={`text-xs ${loggedToday ? "text-foreground-tertiary" : "text-danger"}`}>
              {loggedToday ? "Logged today" : "Not logged yet"}
            </p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-foreground-muted" />
        </button>
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="You">
        <div className="flex flex-col gap-6">
          <Link href={`/members/${memberUserId}`} className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <Avatar src={memberAvatarUrl} name={memberName} size={48} />
            <span className="flex items-center gap-1.5 text-lg font-semibold text-foreground">
              {memberName}
              <LevelBadge level={memberLevel} />
            </span>
          </Link>

          <form
            action={leaveClan.bind(null, clanId)}
            onSubmit={(event) => {
              if (!confirm("Leave this clan? You'll need an invite to rejoin.")) {
                event.preventDefault();
              }
            }}
          >
            <Button type="submit" variant="danger" className="w-full">
              Leave clan
            </Button>
          </form>
        </div>
      </BottomSheet>
    </>
  );
}

"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Avatar } from "@/components/shared/Avatar";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { makeAdmin, nudgeMember, removeMember } from "../actions";

export function MemberActionsSheet({
  clanId,
  memberUserId,
  memberName,
  memberAvatarUrl,
  loggedToday,
  canNudge,
}: {
  clanId: string;
  memberUserId: string;
  memberName: string;
  memberAvatarUrl?: string | null;
  loggedToday: boolean;
  canNudge: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [nudgeState, nudgeAction, nudgePending] = useActionState(
    nudgeMember.bind(null, clanId, memberUserId),
    undefined,
  );

  useEffect(() => {
    if (!nudgeState?.sent) return;
    const timeout = setTimeout(() => setOpen(false), 1200);
    return () => clearTimeout(timeout);
  }, [nudgeState?.sent]);

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
            <p className="truncate text-sm text-foreground">{memberName}</p>
            <p className={`text-xs ${loggedToday ? "text-foreground-tertiary" : "text-danger"}`}>
              {loggedToday ? "Logged today" : "Not logged yet"}
            </p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-foreground-muted" />
        </button>
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Member">
        <div className="flex flex-col gap-6">
          <Link href={`/members/${memberUserId}`} className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <Avatar src={memberAvatarUrl} name={memberName} size={48} />
            <span className="text-lg font-semibold text-foreground">{memberName}</span>
          </Link>

          <div className="flex flex-col gap-2">
            {canNudge && (
              <>
                <form action={nudgeAction}>
                  <Button
                    type="submit"
                    variant="secondary"
                    className="w-full"
                    disabled={nudgePending || nudgeState?.sent}
                  >
                    {nudgeState?.sent ? "Nudged! 👋" : nudgePending ? "Sending..." : "Nudge to log"}
                  </Button>
                </form>
                {nudgeState?.error && <p className="text-sm text-danger">{nudgeState.error}</p>}
              </>
            )}
            <form action={makeAdmin.bind(null, clanId, memberUserId)} onSubmit={() => setOpen(false)}>
              <Button type="submit" variant="secondary" className="w-full">
                Make admin
              </Button>
            </form>
            <form
              action={removeMember.bind(null, clanId, memberUserId)}
              onSubmit={(event) => {
                if (!confirm(`Remove ${memberName} from the clan?`)) {
                  event.preventDefault();
                  return;
                }
                setOpen(false);
              }}
            >
              <Button type="submit" variant="danger" className="w-full">
                Remove from clan
              </Button>
            </form>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

import Link from "next/link";
import { Avatar } from "@/components/shared/Avatar";
import { LevelBadge } from "@/components/shared/LevelBadge";
import { levelForPoints, type LevelCurveConfig } from "@/features/clan-contracts/level";
import { LeaveClanSheet } from "./LeaveClanSheet";
import { MemberActionsSheet } from "./MemberActionsSheet";
import { NudgeSheet } from "./NudgeSheet";
import type { getClanMembers } from "../queries";

type Member = Awaited<ReturnType<typeof getClanMembers>>[number];

export function ClanMembersSection({
  clanId,
  members,
  isAdmin,
  currentUserId,
  loggedToday,
  levelCurveConfig,
}: {
  clanId: string;
  members: Member[];
  isAdmin: boolean;
  currentUserId: string;
  loggedToday: Set<string>;
  levelCurveConfig: LevelCurveConfig;
}) {
  // Anyone who's logged today can nudge anyone (any role) who hasn't — computed from the same
  // loggedToday set already fetched for the "Logged today"/"Not logged yet" row text.
  const canNudge = (targetId: string) =>
    targetId !== currentUserId && !loggedToday.has(targetId) && loggedToday.has(currentUserId);

  return (
    <section className="flex flex-col gap-1 rounded-xl border border-surface-border bg-surface p-5">
      <h2 className="mb-2 font-semibold text-foreground">Members</h2>
      <ul className="flex flex-col divide-y divide-surface-border">
        {members.map(({ user, role }) => {
          const level = levelForPoints(user.totalPoints, levelCurveConfig);
          return (
            <li key={user.id} className="py-3 first:pt-0 last:pb-0">
              {isAdmin && role !== "admin" ? (
                <MemberActionsSheet
                  clanId={clanId}
                  memberUserId={user.id}
                  memberName={user.name}
                  memberAvatarUrl={user.avatarUrl}
                  memberLevel={level}
                  loggedToday={loggedToday.has(user.id)}
                  canNudge={canNudge(user.id)}
                />
              ) : user.id === currentUserId && role !== "admin" ? (
                <LeaveClanSheet
                  clanId={clanId}
                  memberUserId={user.id}
                  memberName={user.name}
                  memberAvatarUrl={user.avatarUrl}
                  memberLevel={level}
                  loggedToday={loggedToday.has(user.id)}
                />
              ) : canNudge(user.id) ? (
                <NudgeSheet
                  clanId={clanId}
                  memberUserId={user.id}
                  memberName={user.name}
                  memberAvatarUrl={user.avatarUrl}
                  memberLevel={level}
                />
              ) : (
                <div className="flex min-w-0 items-center gap-3">
                  <Link href={`/members/${user.id}`} className="shrink-0">
                    <Avatar src={user.avatarUrl} name={user.name} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-1.5 truncate text-sm text-foreground">
                      {user.name}
                      <LevelBadge level={level} />
                      {role === "admin" && (
                        <span className="rounded bg-background px-1.5 py-0.5 text-xs text-foreground-tertiary">
                          Admin
                        </span>
                      )}
                    </p>
                    <p
                      className={`text-xs ${
                        loggedToday.has(user.id) ? "text-foreground-tertiary" : "text-danger"
                      }`}
                    >
                      {loggedToday.has(user.id) ? "Logged today" : "Not logged yet"}
                    </p>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

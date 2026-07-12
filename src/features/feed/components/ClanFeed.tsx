import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { getCommentsForCheckIns, getCommentsForSystemPosts } from "@/features/comments";
import { FEED_PAGE_SIZE, getCheckInById, getClanFeed } from "@/features/check-ins";
import { getClanMembers } from "@/features/clans";
import { getReactionsForCheckIns, getReactionsForSystemPosts } from "@/features/reactions";
import { getSystemPostsForClan } from "@/features/system-posts";
import { FeedList } from "./FeedList";

export async function ClanFeed({
  clanId,
  highlightCheckInId,
  members: providedMembers,
}: {
  clanId: string;
  highlightCheckInId?: string;
  members?: Awaited<ReturnType<typeof getClanMembers>>;
}) {
  const { userId } = await auth();
  // Neither depends on `rows`, so kick both off immediately instead of waiting behind
  // getCheckInById/getClanFeed below — unless the caller already fetched members (e.g. the clan
  // page needs the member list/count anyway), in which case reuse that instead of a second query.
  // System posts aren't paginated (at most one per week — see getSystemPostsForClan), so a clan's
  // whole history is fetched up front rather than dual-cursor-paginated alongside check-ins.
  const membersPromise = providedMembers ? Promise.resolve(providedMembers) : getClanMembers(clanId);
  const systemPostsPromise = getSystemPostsForClan(clanId);

  // A notification can deep-link to a check-in older than what the default (latest) page would
  // include. Anchor the very first page just after it instead, so it's guaranteed to be present
  // without needing unbounded "load more" clicks — this does mean anything newer than the
  // highlighted check-in won't be shown in this view; the Feed tab always has the true latest.
  let rows;
  if (highlightCheckInId) {
    const target = await getCheckInById(highlightCheckInId);
    rows = target
      ? await getClanFeed(clanId, new Date(target.createdAt.getTime() + 1))
      : await getClanFeed(clanId);
  } else {
    rows = await getClanFeed(clanId);
  }

  const systemPosts = await systemPostsPromise;

  if (rows.length === 0 && systemPosts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-surface-border py-10 text-center">
        <p className="text-sm text-foreground-secondary">No check-ins yet. Someone&apos;s got to go first 👀</p>
        <Link href="/logs" className="text-sm font-semibold text-accent">
          Log today →
        </Link>
      </div>
    );
  }

  const checkInIds = rows.map((row) => row.checkIn.id);
  const systemPostIds = systemPosts.map((post) => post.id);
  const [reactions, comments, systemPostReactions, systemPostComments, members] = await Promise.all([
    userId ? getReactionsForCheckIns(checkInIds, clanId, userId) : Promise.resolve({}),
    getCommentsForCheckIns(checkInIds, clanId),
    userId ? getReactionsForSystemPosts(systemPostIds, clanId, userId) : Promise.resolve({}),
    getCommentsForSystemPosts(systemPostIds, clanId),
    membersPromise,
  ]);
  const clanMembers = members.map((m) => ({ id: m.user.id, name: m.user.name, avatarUrl: m.user.avatarUrl }));

  return (
    <FeedList
      clanId={clanId}
      currentUserId={userId}
      clanMembers={clanMembers}
      initialRows={rows}
      initialSystemPosts={systemPosts}
      initialReactions={{ ...reactions, ...systemPostReactions }}
      initialComments={{ ...comments, ...systemPostComments }}
      initialHasMore={rows.length === FEED_PAGE_SIZE}
      highlightCheckInId={highlightCheckInId}
    />
  );
}

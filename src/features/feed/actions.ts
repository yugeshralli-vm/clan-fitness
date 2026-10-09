"use server";

import { auth } from "@clerk/nextjs/server";
import { getCommentsForCheckIns, getCommentsForSystemPosts } from "@/features/comments";
import { getClanFeed } from "@/features/check-ins";
import { getClanMembership } from "@/features/clans";
import { getReactionsForCheckIns, getReactionsForSystemPosts } from "@/features/reactions";
import { getSystemPostsForClan } from "@/features/system-posts";

export async function loadMoreFeed(clanId: string, beforeIso: string, viewerTimezone: string | null) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in.");

  // Authorization and the data fetch don't depend on each other — run them concurrently, but
  // still gate the return on membership so an unauthorized caller never sees the fetched rows.
  const [membership, feed] = await Promise.all([
    getClanMembership(userId, clanId),
    getClanFeed(clanId, viewerTimezone, new Date(beforeIso)),
  ]);
  if (!membership) throw new Error("Not a member of this clan.");

  const { rows, hasMore } = feed;
  const checkInIds = rows.map((row) => row.checkIn.id);
  const [reactions, comments] = await Promise.all([
    getReactionsForCheckIns(checkInIds, clanId, userId),
    getCommentsForCheckIns(checkInIds, clanId),
  ]);

  return { rows, reactions, comments, hasMore };
}

/** The feed's latest page plus every system post, with their reactions/comments — what ClanFeed
 * renders initially. FeedList merges it in when the realtime server says the clan's feed changed. */
export async function loadFeedHead(clanId: string, viewerTimezone: string | null) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in.");

  const [membership, feed, systemPosts] = await Promise.all([
    getClanMembership(userId, clanId),
    getClanFeed(clanId, viewerTimezone),
    getSystemPostsForClan(clanId),
  ]);
  if (!membership) throw new Error("Not a member of this clan.");

  const { rows, hasMore } = feed;
  const checkInIds = rows.map((row) => row.checkIn.id);
  const systemPostIds = systemPosts.map((post) => post.id);
  const [reactions, comments, systemPostReactions, systemPostComments] = await Promise.all([
    getReactionsForCheckIns(checkInIds, clanId, userId),
    getCommentsForCheckIns(checkInIds, clanId),
    getReactionsForSystemPosts(systemPostIds, clanId, userId),
    getCommentsForSystemPosts(systemPostIds, clanId),
  ]);

  // Every id present, even with nothing on it, so the merge can clear a removed last reaction/comment.
  const allReactions = { ...reactions, ...systemPostReactions };
  const allComments = { ...comments, ...systemPostComments };
  const ids = [...checkInIds, ...systemPostIds];
  return {
    rows,
    hasMore,
    systemPosts,
    reactions: Object.fromEntries(ids.map((id) => [id, allReactions[id] ?? {}])),
    comments: Object.fromEntries(ids.map((id) => [id, allComments[id] ?? []])),
  };
}

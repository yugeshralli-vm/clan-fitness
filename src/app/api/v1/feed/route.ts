import { NextResponse } from "next/server";
import { getAppConfig } from "@/features/admin/config";
import { getFoodPhotoUrls, type FoodCheckInValue } from "@/features/check-ins/types";
import { levelForPoints } from "@/features/clan-contracts/level";
import { getCommentCountsForCheckIns, getCommentsForSystemPosts } from "@/features/comments/queries";
import { getClanFeed } from "@/features/check-ins/queries";
import { getClanMembership } from "@/features/clans/queries";
import {
  describeCheckIn,
  dedupeEntriesForDisplay,
  formatDayLabel,
  getCheckInIcon,
  groupByDay,
  groupByUserAndDay,
} from "@/features/feed/group";
import { getReactionsForCheckIns, getReactionsForSystemPosts } from "@/features/reactions/queries";
import type { ReactionSummary } from "@/features/reactions/types";
import { getSystemPostsForClan } from "@/features/system-posts/queries";
import { apiError, requireApiUser } from "@/lib/api-response";
import { refreshUserTimezone } from "@/lib/current-user";
import { isValidTimeZone, userDayKey } from "@/lib/timezone-date";

/** Per emoji, counts and whether the viewer reacted — like the web ReactionBar's pills. */
function reactionCounts(summary: ReactionSummary | undefined) {
  return Object.fromEntries(
    Object.entries(summary ?? {}).map(([emoji, entry]) => [emoji, { count: entry.users.length, reactedByMe: entry.reactedByMe }]),
  );
}

export async function GET(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;

  const params = new URL(request.url).searchParams;
  const clanId = params.get("clanId");
  const before = params.get("before") ?? undefined;
  const timezoneParam = params.get("timezone") ?? undefined;

  if (!clanId) return apiError(400, "clanId is required.");
  if (timezoneParam && !isValidTimeZone(timezoneParam)) return apiError(400, "Invalid timezone.");
  if (before && Number.isNaN(new Date(before).getTime())) return apiError(400, "Invalid before cursor.");

  const user = await refreshUserTimezone(r.user, timezoneParam);
  const viewerTimezone = timezoneParam ?? user.timezone;

  const membership = await getClanMembership(user.id, clanId);
  if (!membership) return apiError(403, "Not a member of this clan.");

  const { rows, hasMore } = await getClanFeed(clanId, viewerTimezone, before ? new Date(before) : undefined);
  const checkInIds = rows.map((row) => row.checkIn.id);
  const [reactionSummaries, commentCounts, levelCurveConfig] = await Promise.all([
    getReactionsForCheckIns(checkInIds, clanId, user.id),
    getCommentCountsForCheckIns(checkInIds, clanId),
    getAppConfig(),
  ]);

  const dayGroups = groupByUserAndDay(rows, viewerTimezone);
  const sections = groupByDay(dayGroups).map((section) => ({
    day: section.day,
    dayLabel: formatDayLabel(section.day, viewerTimezone),
    cards: section.cards.map((card) => {
      // Narrowed from FeedCard to DayGroup — safe since system posts are never in dayGroups.
      const group = card as (typeof dayGroups)[number];
      const cardId = group.entries[group.entries.length - 1].id;
      return {
        cardId,
        user: {
          id: group.user.id,
          name: group.user.name,
          avatarUrl: group.user.avatarUrl,
          level: levelForPoints(group.user.totalPoints, levelCurveConfig),
        },
        latestAt: group.latestAt.toISOString(),
        entries: dedupeEntriesForDisplay(group.entries).map((entry) => ({
          id: entry.id,
          type: entry.type,
          value: entry.value,
          createdAt: entry.createdAt.toISOString(),
          icon: getCheckInIcon(entry.type, entry.value),
          caption: describeCheckIn(entry.type, entry.value, entry.id),
          photoUrls: entry.type === "food" ? getFoodPhotoUrls(entry.value as FoodCheckInValue) : [],
        })),
        // Per emoji, like the web ReactionBar's pills — counts and whether the viewer reacted,
        // not the reactor list itself (that's only needed when someone opens the who-reacted sheet).
        // Kept for app builds from before per-emoji `reactions` existed.
        reactionCount: Object.values(reactionSummaries[cardId] ?? {}).reduce((sum, entry) => sum + entry.users.length, 0),
        reactions: Object.fromEntries(
          Object.entries(reactionSummaries[cardId] ?? {}).map(([emoji, entry]) => [
            emoji,
            { count: entry.users.length, reactedByMe: entry.reactedByMe },
          ]),
        ),
        commentCount: commentCounts[cardId] ?? 0,
      };
    }),
  }));

  const nextCursor = hasMore && rows.length > 0 ? rows[rows.length - 1].checkIn.createdAt.toISOString() : null;

  // Weekly recaps, first page only — the web merges them into its first page the same way
  // (mergeFeedCards). A separate list rather than cards inside `sections`, so app builds that
  // predate recaps keep working; newer ones place each by its `day` and `createdAt`.
  const systemPosts = before ? [] : await getSystemPostsForClan(clanId);
  const systemPostIds = systemPosts.map((post) => post.id);
  const [postReactions, postComments] = await Promise.all([
    getReactionsForSystemPosts(systemPostIds, clanId, user.id),
    getCommentsForSystemPosts(systemPostIds, clanId),
  ]);

  return NextResponse.json({
    sections,
    hasMore,
    nextCursor,
    systemPosts: systemPosts.map((post) => {
      const day = userDayKey(viewerTimezone, post.createdAt);
      return {
        id: post.id,
        day,
        dayLabel: formatDayLabel(day, viewerTimezone),
        createdAt: post.createdAt.toISOString(),
        weekStart: post.weekStart.toISOString(),
        // Exclusive, like the web: the card shows the day before as the week's last day.
        weekEnd: post.weekEnd.toISOString(),
        topThree: post.topThree,
        wallOfShame: post.wallOfShame,
        reactions: reactionCounts(postReactions[post.id]),
        commentCount: postComments[post.id]?.length ?? 0,
      };
    }),
  });
}

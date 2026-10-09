import { NextResponse } from "next/server";
import { getCommentCountsForCheckIns } from "@/features/comments/queries";
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
import { getReactionCountsForCheckIns } from "@/features/reactions/queries";
import { apiError, requireApiUser } from "@/lib/api-response";
import { refreshUserTimezone } from "@/lib/current-user";
import { isValidTimeZone } from "@/lib/timezone-date";

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
  const [reactionCounts, commentCounts] = await Promise.all([
    getReactionCountsForCheckIns(checkInIds, clanId),
    getCommentCountsForCheckIns(checkInIds, clanId),
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
        user: { id: group.user.id, name: group.user.name, avatarUrl: group.user.avatarUrl },
        latestAt: group.latestAt.toISOString(),
        entries: dedupeEntriesForDisplay(group.entries).map((entry) => ({
          id: entry.id,
          type: entry.type,
          value: entry.value,
          createdAt: entry.createdAt.toISOString(),
          icon: getCheckInIcon(entry.type, entry.value),
          caption: describeCheckIn(entry.type, entry.value, entry.id),
        })),
        reactionCount: reactionCounts[cardId] ?? 0,
        commentCount: commentCounts[cardId] ?? 0,
      };
    }),
  }));

  const nextCursor = hasMore && rows.length > 0 ? rows[rows.length - 1].checkIn.createdAt.toISOString() : null;

  return NextResponse.json({ sections, hasMore, nextCursor });
}

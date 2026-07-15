import type { FeedRow } from "@/features/check-ins";
import type {
  FoodCheckInValue,
  FoodStatus,
  GymCheckInValue,
  StepsCheckInValue,
  ThoughtCheckInValue,
} from "@/features/check-ins/types";
import type { SystemPostForFeed } from "@/features/system-posts";
import { userDayKey } from "@/lib/timezone-date";

export const TYPE_ICON: Record<string, string> = { gym: "💪", steps: "👟", food: "🥗", thought: "💭" };

// A pool per status rather than one fixed line each, so the feed doesn't read like a template —
// picked deterministically per check-in (see pickDeterministic) so the same entry doesn't change
// wording on every reload.
const FOOD_STATUS_PHRASES: Record<FoodStatus, string[]> = {
  yes: [
    "Nailed it",
    "Locked in",
    "On point",
    "Goal met",
    "Crushed it",
    "Dialed in",
    "Green flag",
    "Good job, me",
    "Chef's kiss",
    "Let's go",
  ],
  partial: [
    "Almost",
    "Close enough",
    "Getting there",
    "Halfway",
    "So close",
    "Nearly",
    "Almost there",
    "Close call",
    "Not bad",
    "Nearly there",
  ],
  no: [
    "Me vs. discipline",
    "Discipline lost",
    "Not today",
    "Maybe tomorrow",
    "Oops.",
    "We'll reset.",
    "Skill issue.",
    "I folded.",
    "The snacks won.",
    "We don't talk about it.",
  ],
};

// Deterministic, not random — the same check-in must show the same phrase on every render (the
// feed re-renders on every page load), so the pick is seeded by the check-in's own id instead of
// Math.random().
function pickDeterministic<T>(items: T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return items[Math.abs(hash) % items.length];
}

// A food check-in without a status is just a shared photo — not necessarily of food — so it gets
// a camera icon instead of TYPE_ICON's fork-and-plate.
export function getCheckInIcon(type: string, value: unknown) {
  if (type === "food" && !(value as FoodCheckInValue).status) return "📷";
  return TYPE_ICON[type] ?? "✅";
}

export function describeCheckIn(type: string, value: unknown, checkInId: string) {
  switch (type) {
    case "gym": {
      const { note } = value as GymCheckInValue;
      return note ? `Worked out — "${note}"` : "Worked out";
    }
    case "steps": {
      const { count } = value as StepsCheckInValue;
      return `Logged ${count.toLocaleString("en-US")} steps`;
    }
    case "food": {
      // A photo can be logged without a nutrition status now — the photo itself always renders
      // inline in the feed card regardless (see FeedList.tsx), this is just the caption line above it.
      const { status, note } = value as FoodCheckInValue;
      if (!status) return note ? `Shared a photo — "${note}"` : "Shared a photo";
      const label = pickDeterministic(FOOD_STATUS_PHRASES[status], checkInId);
      return note ? `${label} — "${note}"` : label;
    }
    // Rendered as a title above the rest of the card in FeedList.tsx, not through this generic
    // per-entry caption path — this case exists as a fallback/for consistency only.
    case "thought": {
      const { text } = value as ThoughtCheckInValue;
      return text;
    }
    default:
      return "Checked in";
  }
}

export function groupByUserAndDay(rows: FeedRow[], timezone: string | null | undefined) {
  const groups = new Map<
    string,
    { kind: "checkIn"; user: FeedRow["user"]; day: string; latestAt: Date; entries: FeedRow["checkIn"][] }
  >();

  for (const { checkIn, user } of rows) {
    const day = userDayKey(timezone, checkIn.createdAt);
    const key = `${user.id}:${day}`;
    const group = groups.get(key);
    if (group) {
      group.entries.push(checkIn);
      if (checkIn.createdAt > group.latestAt) group.latestAt = checkIn.createdAt;
    } else {
      groups.set(key, { kind: "checkIn", user, day, latestAt: checkIn.createdAt, entries: [checkIn] });
    }
  }

  return [...groups.values()].sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime());
}

export type DayGroup = ReturnType<typeof groupByUserAndDay>[number];

// A group's entries can rarely contain more than one check-in of the same type — the per-day
// dedup on write (getTodaysCheckIn) is keyed by the AUTHOR's own timezone at submission time,
// while a group's day boundary here is keyed by the VIEWER's timezone, and either can drift (e.g.
// a device briefly reporting a different zone re-syncs `users.timezone` — see TimezoneSync.tsx)
// enough to land two real calendar days in one viewer-day. The later check-in is what's meaningful
// (a steps/gym/food entry represents "the current value for that day," not an additional one), so
// display always goes through this rather than the raw list. Entries are newest-first (see
// groupByUserAndDay above), so the first occurrence of a type is already the latest — no createdAt
// comparison needed. `group.entries` itself is left untouched — reactions/comments/the
// notification anchor are all bound to specific ids within it and must stay stable.
export function dedupeEntriesForDisplay(entries: FeedRow["checkIn"][]) {
  const seenTypes = new Set<string>();
  return entries.filter((checkIn) => {
    if (seenTypes.has(checkIn.type)) return false;
    seenTypes.add(checkIn.type);
    return true;
  });
}

export type SystemPostFeedItem = { kind: "systemPost"; day: string; latestAt: Date; post: SystemPostForFeed };

export type FeedCard = DayGroup | SystemPostFeedItem;

// Weekly system posts aren't paginated (see getSystemPostsForClan) — a clan's whole history is
// merged in up front rather than dual-cursor-paginated alongside check-ins.
export function mergeFeedCards(checkInGroups: DayGroup[], systemPosts: SystemPostForFeed[], timezone: string | null | undefined): FeedCard[] {
  const systemPostItems: SystemPostFeedItem[] = systemPosts.map((post) => ({
    kind: "systemPost",
    day: userDayKey(timezone, post.createdAt),
    latestAt: post.createdAt,
    post,
  }));
  return [...checkInGroups, ...systemPostItems].sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime());
}

export function groupByDay(cards: FeedCard[]) {
  const sections: { day: string; cards: FeedCard[] }[] = [];
  for (const card of cards) {
    const last = sections[sections.length - 1];
    if (last && last.day === card.day) {
      last.cards.push(card);
    } else {
      sections.push({ day: card.day, cards: [card] });
    }
  }
  return sections;
}

export function formatDayLabel(day: string, timezone: string | null | undefined) {
  const now = new Date();
  const today = userDayKey(timezone, now);
  const yesterday = userDayKey(timezone, new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

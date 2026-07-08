import type { FeedRow } from "@/features/check-ins";
import type { FoodCheckInValue, FoodStatus, GymCheckInValue, StepsCheckInValue } from "@/features/check-ins/types";

export const TYPE_ICON: Record<string, string> = { gym: "💪", steps: "👟", food: "🥗" };

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
    default:
      return "Checked in";
  }
}

export function groupByUserAndDay(rows: FeedRow[]) {
  const groups = new Map<
    string,
    { user: FeedRow["user"]; day: string; latestAt: Date; entries: FeedRow["checkIn"][] }
  >();

  for (const { checkIn, user } of rows) {
    const day = checkIn.createdAt.toISOString().slice(0, 10);
    const key = `${user.id}:${day}`;
    const group = groups.get(key);
    if (group) {
      group.entries.push(checkIn);
      if (checkIn.createdAt > group.latestAt) group.latestAt = checkIn.createdAt;
    } else {
      groups.set(key, { user, day, latestAt: checkIn.createdAt, entries: [checkIn] });
    }
  }

  return [...groups.values()].sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime());
}

export type DayGroup = ReturnType<typeof groupByUserAndDay>[number];

export function groupByDay(groups: DayGroup[]) {
  const sections: { day: string; cards: DayGroup[] }[] = [];
  for (const group of groups) {
    const last = sections[sections.length - 1];
    if (last && last.day === group.day) {
      last.cards.push(group);
    } else {
      sections.push({ day: group.day, cards: [group] });
    }
  }
  return sections;
}

export function formatDayLabel(day: string) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

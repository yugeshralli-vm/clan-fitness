export type CheckInType = "gym" | "steps" | "food" | "thought";
export type CheckInVisibility = "public_to_clan" | "private";
export type FoodStatus = "yes" | "no" | "partial";

export type GymCheckInValue = { note?: string; durationMinutes?: number };
export type StepsCheckInValue = { count: number };
// status is optional: photos can be logged on their own, independent of answering the nutrition
// question. Max 3 photos, enforced client-side (DailyLogForm) and server-side (logDailyCheckIn).
export type FoodCheckInValue = { status?: FoodStatus; note?: string; photoUrls?: string[] };
// A free-text "what's on your mind" for the day — its own check-in type (not a field bolted onto
// gym/steps/food) so a thought-only day still produces a valid feed card, and reuses the existing
// per-day upsert/grouping/anchor machinery for free. See FeedList.tsx for its title-style rendering.
export type ThoughtCheckInValue = { text: string };

// Check-ins logged before multi-photo support stored a single `photoUrl` string. Reading only
// `photoUrls` would silently drop those older photos from the feed, so every read site should go
// through this instead of accessing `photoUrls` directly.
export function getFoodPhotoUrls(value: FoodCheckInValue | undefined): string[] {
  if (!value) return [];
  if (value.photoUrls) return value.photoUrls;
  const legacyUrl = (value as { photoUrl?: string }).photoUrl;
  return legacyUrl ? [legacyUrl] : [];
}

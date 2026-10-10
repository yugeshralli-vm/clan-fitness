import "server-only";

import type { HistoryDayGroup } from "@/features/check-ins/history-actions";
import { getFoodPhotoUrls, type FoodCheckInValue } from "@/features/check-ins/types";
import { describeCheckIn, getCheckInIcon } from "@/features/feed/group";

/** A history page as the app gets it — each entry with the icon and caption the web's HistorySection renders. */
export function toApiHistory({ days, hasMore }: { days: HistoryDayGroup[]; hasMore: boolean }) {
  return {
    hasMore,
    days: days.map((day) => ({
      dayKey: day.dayKey,
      entries: day.entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        value: entry.value,
        createdAt: entry.createdAt.toISOString(),
        icon: getCheckInIcon(entry.type, entry.value),
        caption: describeCheckIn(entry.type, entry.value, entry.id),
        photoUrls: entry.type === "food" ? getFoodPhotoUrls(entry.value as FoodCheckInValue) : [],
      })),
    })),
  };
}

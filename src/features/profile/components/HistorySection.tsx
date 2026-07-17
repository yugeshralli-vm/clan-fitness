"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { getFilteredHistory, getFilteredHistoryForUser } from "@/features/check-ins/history-actions";
import type { HistoryDayGroup, HistoryRange } from "@/features/check-ins/history-actions";
import { getFoodPhotoUrls } from "@/features/check-ins/types";
import type { CheckInType, FoodCheckInValue } from "@/features/check-ins/types";
import { describeCheckIn, getCheckInIcon } from "@/features/feed/group";

const TYPE_OPTIONS: { value: CheckInType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "gym", label: "Gym" },
  { value: "steps", label: "Steps" },
  { value: "food", label: "Food" },
];

const RANGE_OPTIONS: { value: HistoryRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

// "en-CA" formats as YYYY-MM-DD directly, matching userDayKey's format — a lightweight client-side
// equivalent for just this Today/Yesterday comparison, without needing the server-only
// src/lib/timezone-date.ts module (the actual grouping is already done server-side, see
// history-actions.ts's groupByDay).
function localDayKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}

function dayLabel(dayKey: string, timezone: string) {
  const now = new Date();
  if (dayKey === localDayKey(now, timezone)) return "Today";
  if (dayKey === localDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000), timezone)) return "Yesterday";
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function HistorySection({
  initialDays,
  initialHasMore,
  timezone,
  userId,
}: {
  initialDays: HistoryDayGroup[];
  initialHasMore: boolean;
  timezone: string;
  /** Viewing someone else's history (read-only profile) — omit for the signed-in user's own. */
  userId?: string;
}) {
  const [type, setType] = useState<CheckInType | "all">("all");
  const [range, setRange] = useState<HistoryRange>("30d");
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const [days, setDays] = useState(initialDays);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, startTransition] = useTransition();

  function fetchPage(nextType: CheckInType | "all", nextRange: HistoryRange, before?: string) {
    return userId
      ? getFilteredHistoryForUser(userId, nextType, nextRange, before)
      : getFilteredHistory(nextType, nextRange, before);
  }

  function applyFilters(nextType: CheckInType | "all", nextRange: HistoryRange) {
    setType(nextType);
    setRange(nextRange);
    startTransition(async () => {
      const result = await fetchPage(nextType, nextRange);
      setDays(result.days);
      setHasMore(result.hasMore);
    });
  }

  function handleLoadMore() {
    const lastDay = days[days.length - 1];
    const lastEntry = lastDay?.entries[lastDay.entries.length - 1];
    if (!lastEntry) return;
    startTransition(async () => {
      const result = await fetchPage(type, range, lastEntry.createdAt.toISOString());
      setDays((prev) => [...prev, ...result.days]);
      setHasMore(result.hasMore);
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-surface-border bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-foreground">History</h2>
        <button
          type="button"
          onClick={() => setRangePickerOpen(true)}
          className="flex min-h-9 items-center gap-1 text-sm text-foreground-secondary"
        >
          {RANGE_OPTIONS.find((r) => r.value === range)?.label}
          <ChevronDown size={14} className="shrink-0 text-foreground-tertiary" />
        </button>
      </div>

      <div className="flex gap-2">
        {TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => applyFilters(option.value, range)}
            className={`min-h-9 rounded-full border px-3 text-sm font-medium transition-colors ${
              type === option.value
                ? "border-accent bg-accent/10 text-accent"
                : "border-surface-border text-foreground-tertiary"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {days.length === 0 && !pending ? (
        <p className="py-6 text-center text-sm text-foreground-tertiary">No logs in this range.</p>
      ) : (
        <ul className={`flex flex-col gap-4 transition-opacity ${pending ? "opacity-50" : ""}`}>
          {days.map((day) => (
            <li key={day.dayKey} className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
                {dayLabel(day.dayKey, timezone)}
              </p>
              <ul className="flex flex-col gap-2">
                {day.entries.map((entry) => {
                  const photoUrls =
                    entry.type === "food" ? getFoodPhotoUrls(entry.value as FoodCheckInValue) : [];
                  return (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-1.5 rounded-lg border border-surface-border bg-background p-3"
                    >
                      <p className="flex items-center gap-1.5 text-sm text-foreground-secondary">
                        <span aria-hidden>{getCheckInIcon(entry.type, entry.value)}</span>
                        {describeCheckIn(entry.type, entry.value, entry.id)}
                      </p>
                      {photoUrls.length > 0 && (
                        <div className="flex gap-1.5">
                          {photoUrls.map((url) => (
                            <Image
                              key={url}
                              src={url}
                              alt=""
                              width={56}
                              height={56}
                              className="h-14 w-14 rounded-lg object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={pending}
          className="flex min-h-11 items-center justify-center self-center px-4 text-sm font-semibold text-accent disabled:opacity-40"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : "Load more"}
        </button>
      )}

      <BottomSheet open={rangePickerOpen} onClose={() => setRangePickerOpen(false)} title="Show history for">
        <div className="flex flex-col gap-1">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                applyFilters(type, option.value);
                setRangePickerOpen(false);
              }}
              className={`flex min-h-11 items-center rounded-lg px-3 text-left text-sm transition-colors ${
                option.value === range
                  ? "bg-accent/10 font-semibold text-accent"
                  : "text-foreground hover:bg-background"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </BottomSheet>
    </section>
  );
}

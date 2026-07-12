"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/shared/Avatar";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { getClanMembers } from "../queries";

const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

type Member = Awaited<ReturnType<typeof getClanMembers>>[number];

export type LeaderboardEntry = {
  user: Member["user"];
  periodCount: number;
  periodTarget: number;
  periodSteps: number;
  periodStepsTarget: number;
  streak: number;
  stepPct: number;
  gymPct: number;
};

type Period = "today" | "week" | "month";

const PERIOD_LABELS: Record<Period, string> = { today: "Today", week: "This week", month: "This month" };
const PERIODS: Period[] = ["today", "week", "month"];

export function ClanLeaderboardSection({
  leaderboardsByPeriod,
}: {
  leaderboardsByPeriod: Record<Period, LeaderboardEntry[]>;
}) {
  const [period, setPeriod] = useState<Period>("week");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showPercent, setShowPercent] = useState(false);
  const leaderboard = leaderboardsByPeriod[period];

  return (
    <section className="flex flex-col gap-1 rounded-xl border border-surface-border bg-surface p-5">
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="mb-2 flex min-h-9 w-fit items-center gap-1 font-semibold text-foreground"
      >
        {PERIOD_LABELS[period]}
        <ChevronDown size={16} className="shrink-0 text-foreground-tertiary" />
      </button>

      <ul className="flex flex-col divide-y divide-surface-border">
        {leaderboard.map(
          ({ user, periodCount, periodTarget, periodSteps, periodStepsTarget, streak, stepPct, gymPct }) => (
            <li key={user.id} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Avatar src={user.avatarUrl} name={user.name} />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{user.name}</span>
              <button
                type="button"
                onClick={() => setShowPercent((prev) => !prev)}
                aria-pressed={showPercent}
                aria-label="Toggle whole leaderboard between raw values and percent of goal"
                className="flex min-h-11 shrink-0 flex-col items-end justify-center text-sm text-foreground-secondary"
              >
                {showPercent ? (
                  <>
                    <span>
                      <span className="font-bold text-accent">{Math.round(stepPct)}%</span>{" "}
                      <span className="text-foreground-tertiary">steps</span>
                    </span>
                    <span>
                      <span className="font-bold text-accent">{Math.round(gymPct)}%</span>{" "}
                      <span className="text-foreground-tertiary">gym</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      <span className="font-bold text-accent">{compactNumber.format(periodSteps)}</span>/
                      {compactNumber.format(periodStepsTarget)}{" "}
                      <span className="text-foreground-tertiary">steps</span>
                    </span>
                    <span>
                      <span className="font-bold text-accent">{periodCount}</span>/
                      {compactNumber.format(periodTarget)} <span className="text-foreground-tertiary">gym</span>
                    </span>
                  </>
                )}
              </button>
              <span className="shrink-0 text-sm font-semibold text-ember">{streak}🔥</span>
            </li>
          ),
        )}
      </ul>

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Show leaderboard for">
        <div className="flex flex-col gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPeriod(p);
                setPickerOpen(false);
              }}
              className={`flex min-h-11 items-center rounded-lg px-3 text-left text-sm transition-colors ${
                p === period ? "bg-accent/10 font-semibold text-accent" : "text-foreground hover:bg-background"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </BottomSheet>
    </section>
  );
}

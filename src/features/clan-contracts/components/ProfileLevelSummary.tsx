"use client";

import { useEffect, useMemo, useState } from "react";
import { LevelBadge } from "@/components/shared/LevelBadge";
import { celebrate } from "@/components/ui/reward-snackbar";
import { getMyLivePendingPoints } from "../actions";
import { levelProgress } from "../level";
import type { LevelCurveConfig } from "../level";

const POLL_INTERVAL_MS = 5000;

function levelSeenKey(userId: string) {
  return `profile-level-seen:${userId}`;
}

export function ProfileLevelSummary({
  userId,
  totalPoints,
  levelCurveConfig,
}: {
  userId: string;
  totalPoints: number;
  levelCurveConfig: LevelCurveConfig;
}) {
  // Contracts satisfied but not yet finalized by the nightly cron — added on top of the
  // permanent totalPoints so the level/progress bar reacts the instant a contract is completed
  // instead of waiting for the next day. Purely additive display state, never persisted; it falls
  // back to 0 on its own once the cron folds a claim's points into totalPoints for real.
  const [pendingPoints, setPendingPoints] = useState(0);
  const progress = useMemo(
    () => levelProgress(totalPoints + pendingPoints, levelCurveConfig),
    [totalPoints, pendingPoints, levelCurveConfig],
  );
  const { level, pointsIntoLevel, pointsForNextLevel } = progress;

  useEffect(() => {
    const interval = setInterval(async () => {
      setPendingPoints(await getMyLivePendingPoints());
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Resolution happens server-side via a daily cron, not a live session, so a level-up is
  // detected here on next visit instead: compare against the last level this browser saw and
  // celebrate only the first time it's higher — same "seen" pattern BottomNav already uses for
  // unread dots (see chatSeenKey/feedSeenKey), just keyed per-feature. Now also fires the instant
  // pendingPoints pushes the live level past the last-seen one, not just after the cron runs.
  useEffect(() => {
    const key = levelSeenKey(userId);
    const seen = Number(localStorage.getItem(key) ?? "0");
    if (level > seen) {
      celebrate.levelUp(level);
    }
    localStorage.setItem(key, String(level));
  }, [userId, level]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-surface-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <LevelBadge level={level} />
        <p className="text-sm font-semibold text-foreground">Level {level}</p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress.progress * 100}%` }} />
      </div>
      <p className="text-xs text-foreground-tertiary">
        {pointsIntoLevel} / {pointsForNextLevel} points to Level {level + 1}
      </p>
    </div>
  );
}

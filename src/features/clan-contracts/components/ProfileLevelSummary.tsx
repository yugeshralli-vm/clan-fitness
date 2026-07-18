"use client";

import { useEffect } from "react";
import { LevelBadge } from "@/components/shared/LevelBadge";
import { celebrate } from "@/components/ui/reward-snackbar";
import type { LevelProgress } from "../level";

function levelSeenKey(userId: string) {
  return `profile-level-seen:${userId}`;
}

export function ProfileLevelSummary({ userId, progress }: { userId: string; progress: LevelProgress }) {
  const { level, pointsIntoLevel, pointsForNextLevel } = progress;

  // Resolution happens server-side via a daily cron, not a live session, so a level-up is
  // detected here on next visit instead: compare against the last level this browser saw and
  // celebrate only the first time it's higher — same "seen" pattern BottomNav already uses for
  // unread dots (see chatSeenKey/feedSeenKey), just keyed per-feature.
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
        <div className="h-full rounded-full bg-accent" style={{ width: `${progress.progress * 100}%` }} />
      </div>
      <p className="text-xs text-foreground-tertiary">
        {pointsIntoLevel} / {pointsForNextLevel} points to Level {level + 1}
      </p>
    </div>
  );
}

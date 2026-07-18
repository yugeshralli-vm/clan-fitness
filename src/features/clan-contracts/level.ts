export type LevelCurveConfig = { levelCurveK: number; levelCurveExponent: number };

/** Cumulative points required to reach `level` (level 1 = 0 points). */
export function pointsForLevel(level: number, config: LevelCurveConfig): number {
  if (level <= 1) return 0;
  return Math.round(config.levelCurveK * Math.pow(level - 1, config.levelCurveExponent));
}

export function levelForPoints(totalPoints: number, config: LevelCurveConfig): number {
  if (totalPoints <= 0) return 1;
  return Math.floor(1 + Math.pow(totalPoints / config.levelCurveK, 1 / config.levelCurveExponent));
}

export type LevelProgress = {
  level: number;
  pointsIntoLevel: number;
  pointsForNextLevel: number;
  progress: number; // 0..1
};

export function levelProgress(totalPoints: number, config: LevelCurveConfig): LevelProgress {
  const level = levelForPoints(totalPoints, config);
  const floor = pointsForLevel(level, config);
  const ceil = pointsForLevel(level + 1, config);
  const span = Math.max(ceil - floor, 1);
  return {
    level,
    pointsIntoLevel: totalPoints - floor,
    pointsForNextLevel: ceil - floor,
    progress: Math.min(Math.max((totalPoints - floor) / span, 0), 1),
  };
}

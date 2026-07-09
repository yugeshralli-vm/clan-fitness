import "server-only";

import { db } from "@/db";
import { appConfig } from "@/db/schema";

// Fallbacks used whenever a key has never been set — the table can start (and largely stay)
// completely empty and behave identically to the old hardcoded constants until something is
// actually changed from the admin dashboard.
const CONFIG_DEFAULTS = {
  stepWeight: 0.5,
  streakWeight: 0.25,
  gymWeight: 0.25,
  streakCapDays: 7,
  defaultWeeklyGymTarget: 4,
  defaultDailyStepsTarget: 8000,
} as const;

export type ConfigKey = keyof typeof CONFIG_DEFAULTS;
export const CONFIG_KEYS = Object.keys(CONFIG_DEFAULTS) as ConfigKey[];

export async function getAppConfig(): Promise<Record<ConfigKey, number>> {
  const rows = await db.select().from(appConfig);
  const stored = new Map(rows.map((row) => [row.key, row.value]));

  const result = {} as Record<ConfigKey, number>;
  for (const key of CONFIG_KEYS) {
    const raw = stored.get(key);
    const parsed = raw !== undefined ? Number(raw) : NaN;
    result[key] = Number.isFinite(parsed) ? parsed : CONFIG_DEFAULTS[key];
  }
  return result;
}

// IST has no DST, so a fixed +5:30 offset safely answers "which calendar day is this" year-round
// (see check-ins/queries.ts's startOfWeek for the same fixed-offset approach applied to the week
// boundary). Centralized here — feed grouping, streaks, and leaderboard periods all need to agree
// on the same day, instead of each re-deriving a UTC-day boundary that silently disagrees with
// how IST users experience "today" for the ~5.5 hours after UTC midnight.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function startOfIstDay(now = new Date()) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

export function startOfIstMonth(now = new Date()) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1, 0, 0, 0, 0) - IST_OFFSET_MS);
}

export function daysInIstMonth(now = new Date()) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate();
}

// Which IST calendar day an instant belongs to, as a sortable "YYYY-MM-DD" key.
export function istDayKey(date: Date) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

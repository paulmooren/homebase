/**
 * Reminder schedules. All dates are date-only values held as UTC midnight, the
 * way Prisma's `@db.Date` columns come back, so day arithmetic never drifts
 * across daylight-saving changes.
 */
export type ScheduleUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";
export type ScheduleMode = "FROM_DONE" | "FIXED";

export const SCHEDULE_UNITS: ScheduleUnit[] = ["DAY", "WEEK", "MONTH", "YEAR"];

/** The household's own clock: "today" is decided here, not in the server's UTC. */
export const HOUSEHOLD_TIME_ZONE = "Europe/Amsterdam";

/** Today's date in the household's time zone, as UTC midnight. */
export function todayInHousehold(now: Date = new Date()): Date {
  const [y, m, d] = now
    .toLocaleDateString("en-CA", { timeZone: HOUSEHOLD_TIME_ZONE })
    .split("-")
    .map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Adds N units to a date; a month or year step clamps to the month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addInterval(date: Date, count: number, unit: ScheduleUnit): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  switch (unit) {
    case "DAY":
      return new Date(Date.UTC(y, m, d + count));
    case "WEEK":
      return new Date(Date.UTC(y, m, d + count * 7));
    case "MONTH":
    case "YEAR": {
      const months = unit === "YEAR" ? count * 12 : count;
      const target = new Date(Date.UTC(y, m + months, 1));
      const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay)));
    }
  }
}

/**
 * When a Reminder is due after it was done on `today`.
 * FROM_DONE counts from today. FIXED keeps its rhythm from the old due date,
 * skipping any occurrences already in the past so a very late tick doesn't
 * leave it overdue again straight away.
 */
export function nextDueDate(opts: {
  mode: ScheduleMode;
  dueDate: Date;
  today: Date;
  count: number;
  unit: ScheduleUnit;
}): Date {
  const { mode, dueDate, today, count, unit } = opts;
  if (mode === "FROM_DONE") return addInterval(today, count, unit);
  let next = addInterval(dueDate, count, unit);
  let guard = 0;
  while (next.getTime() <= today.getTime() && guard++ < 5000) next = addInterval(next, count, unit);
  return next;
}

const UNIT_WORDS: Record<ScheduleUnit, [string, string]> = {
  DAY: ["day", "days"],
  WEEK: ["week", "weeks"],
  MONTH: ["month", "months"],
  YEAR: ["year", "years"],
};

export function unitLabel(unit: ScheduleUnit, count: number) {
  return UNIT_WORDS[unit][count === 1 ? 0 : 1];
}

/** "Every day", "Every 3 days", "Every week", "Every 2 months". */
export function describeSchedule(count: number, unit: ScheduleUnit): string {
  return count === 1 ? `Every ${UNIT_WORDS[unit][0]}` : `Every ${count} ${UNIT_WORDS[unit][1]}`;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export type DueBucket = "overdue" | "today" | "week" | "later";

/** Where a due date sits relative to today: overdue, today, within the next 7 days, or later. */
export function dueBucket(due: Date, today: Date): DueBucket {
  const days = daysBetween(today, due);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "later";
}

/** "Today", "Tomorrow", "in 4 days", "3 days overdue", "Yesterday". */
export function dueLabel(due: Date, today: Date): string {
  const days = daysBetween(today, due);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1) return days <= 14 ? `in ${days} days` : due.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${-days} days overdue`;
}

/** "3 days ago", "today", "yesterday" — for "last done". */
export function agoLabel(date: Date, today: Date): string {
  const done = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const days = daysBetween(done, today);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

/**
 * Whether a payment lands where a recurring item expects one. Slots repeat
 * from a reference payment by the item's interval; a payment counts when it is
 * close to a slot (about a third of the interval either way, at most a month),
 * and is not in the same slot as the reference itself — a second payment in
 * the same period is an extra, not the next occurrence. So a one-off on the 17th
 * is not the monthly payment that arrives on the 1st, however alike the amounts.
 */
const DAY = 86_400_000;

export function intervalDays(count: number, unit: "DAY" | "WEEK" | "MONTH" | "YEAR"): number {
  const n = Math.max(1, count);
  switch (unit) {
    case "DAY":
      return n;
    case "WEEK":
      return 7 * n;
    case "MONTH":
      return 30.44 * n;
    case "YEAR":
      return 365.25 * n;
  }
}

export function onSchedule(
  reference: Date,
  date: Date,
  count: number,
  unit: "DAY" | "WEEK" | "MONTH" | "YEAR",
): boolean {
  const every = intervalDays(count, unit);
  const days = (date.getTime() - reference.getTime()) / DAY;
  const slot = Math.round(days / every);
  if (slot === 0) return false;
  const tolerance = Math.min(31, Math.max(2, 0.3 * every));
  return Math.abs(days - slot * every) <= tolerance;
}

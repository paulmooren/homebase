import type { RecurringFrequency } from "@/lib/constants";

/** Average day-gap ranges that count as each frequency — wide enough to absorb
 * weekends/month-length jitter, narrow enough not to collide with each other. */
const FREQUENCY_WINDOWS: { frequency: RecurringFrequency; min: number; max: number }[] = [
  { frequency: "WEEKLY", min: 6, max: 8 },
  { frequency: "MONTHLY", min: 27, max: 33 },
  { frequency: "YEARLY", min: 355, max: 375 },
];

export function monthlyEquivalent(amount: number, frequency: RecurringFrequency): number {
  switch (frequency) {
    case "WEEKLY":
      return (amount * 52) / 12;
    case "YEARLY":
      return amount / 12;
    case "MONTHLY":
    default:
      return amount;
  }
}

export function nextOccurrence(from: Date, frequency: RecurringFrequency): Date {
  const next = new Date(from);
  if (frequency === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
  else if (frequency === "YEARLY") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function normalizeName(merchant: string): string {
  return merchant.trim().toLowerCase().replace(/\s+/g, " ");
}

function amountsMatch(a: number, b: number): boolean {
  const tolerance = Math.max(1, Math.abs(a) * 0.03);
  return Math.abs(a - b) <= tolerance;
}

function frequencyForGap(avgGapDays: number): RecurringFrequency | null {
  const window = FREQUENCY_WINDOWS.find((w) => avgGapDays >= w.min && avgGapDays <= w.max);
  return window?.frequency ?? null;
}

export type RecurringCandidate = {
  name: string;
  type: "EXPENSE" | "INCOME";
  amount: number;
  frequency: RecurringFrequency;
  occurrences: number;
  lastDate: Date;
  nextDueDate: Date;
  categoryId: string | null;
  ownerId: string | null;
  accountId: string | null;
};

/**
 * Groups EXPENSE/INCOME transactions by normalized merchant name and looks for
 * a fairly consistent amount recurring at a fairly consistent interval. This is
 * a static heuristic, not ML — it only sees transactions already in the app
 * (manual entries or CSV imports), so it can only be as good as that history.
 */
export function detectRecurringCandidates(
  transactions: {
    merchant: string;
    type: "EXPENSE" | "INCOME" | "TRANSFER";
    amount: number;
    date: Date;
    categoryId: string | null;
    ownerId: string | null;
    accountId: string | null;
  }[],
): RecurringCandidate[] {
  const groups = new Map<string, typeof transactions>();

  for (const tx of transactions) {
    if (tx.type === "TRANSFER") continue;
    const key = `${tx.type}::${normalizeName(tx.merchant)}`;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const candidates: RecurringCandidate[] = [];

  for (const [, group] of groups) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Require every consecutive pair to have a similar amount — a single
    // matching pair among many mismatches shouldn't count as recurring.
    const amountsConsistent = sorted.every((tx, i) =>
      i === 0 ? true : amountsMatch(Number(tx.amount), Number(sorted[i - 1].amount)),
    );
    if (!amountsConsistent) continue;

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = (sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / 86_400_000;
      gaps.push(days);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const frequency = frequencyForGap(avgGap);
    if (!frequency) continue;

    const last = sorted[sorted.length - 1];
    const avgAmount = sorted.reduce((sum, tx) => sum + Number(tx.amount), 0) / sorted.length;

    candidates.push({
      name: last.merchant.trim(),
      type: last.type as "EXPENSE" | "INCOME",
      amount: Math.round(avgAmount * 100) / 100,
      frequency,
      occurrences: sorted.length,
      lastDate: last.date,
      nextDueDate: nextOccurrence(last.date, frequency),
      categoryId: last.categoryId,
      ownerId: last.ownerId,
      accountId: last.accountId,
    });
  }

  return candidates;
}

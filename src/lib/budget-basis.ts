/**
 * How a Recurring item's Budgeted amount is taken from its Payments, and when
 * a change is worth asking the Member about. Pure, so the same numbers show
 * in the history panel and drive the proposals on the server.
 */
export type BudgetBasis = "LATEST" | "LOWEST" | "HIGHEST" | "AVERAGE" | "FIXED";

export const BASES: BudgetBasis[] = ["LATEST", "LOWEST", "HIGHEST", "AVERAGE", "FIXED"];

/** Lowest, Highest and Average look at this many of the most recent Payments. */
export const BASIS_WINDOW = 6;

/** Two amounts are "the same" within 3% (or a euro, for small ones). */
export function sameAmount(a: number, b: number) {
  return Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.03);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The amount a basis gives for these Payments (oldest first). Null for Fixed,
 * which is typed rather than derived, and when there are no Payments.
 */
export function amountForBasis(basis: BudgetBasis, payments: number[]): number | null {
  if (basis === "FIXED" || payments.length === 0) return null;
  const recent = payments.slice(-BASIS_WINDOW);
  switch (basis) {
    case "LATEST":
      return payments[payments.length - 1];
    case "LOWEST":
      return Math.min(...recent);
    case "HIGHEST":
      return Math.max(...recent);
    case "AVERAGE":
      return round2(recent.reduce((a, b) => a + b, 0) / recent.length);
  }
}

/**
 * What to ask the Member, if anything: a new figure for a derived basis when
 * it differs from the current Budgeted amount and isn't the one they already
 * said Keep to; for a Fixed item only a quiet note that its Payments drifted.
 */
export function reviewAmount(opts: {
  basis: BudgetBasis;
  amount: number;
  keptAmount: number | null;
  payments: number[];
}): { proposal: number | null; drift: number | null } {
  const { basis, amount, keptAmount, payments } = opts;
  if (payments.length === 0) return { proposal: null, drift: null };

  if (basis === "FIXED") {
    const latest = payments[payments.length - 1];
    return { proposal: null, drift: sameAmount(latest, amount) ? null : latest };
  }
  const candidate = amountForBasis(basis, payments)!;
  if (sameAmount(candidate, amount)) return { proposal: null, drift: null };
  if (keptAmount !== null && sameAmount(candidate, keptAmount)) return { proposal: null, drift: null };
  return { proposal: candidate, drift: null };
}

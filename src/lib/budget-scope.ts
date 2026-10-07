import { monthlyEquivalent } from "@/lib/recurring";
import type { ScheduleUnit } from "@/lib/schedule";

/**
 * "Left each month" is worked out per scope, never across them: You (your
 * personal accounts together), Household (the shared accounts together), or
 * a partner's accounts you can see. Adding personal and shared money
 * together would count a transfer between them twice, so they stay apart.
 */
export type ScopeKey = string;
export const YOU: ScopeKey = "you";
export const HOUSEHOLD: ScopeKey = "household";

export type BudgetItem = {
  id: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  amount: number;
  intervalCount: number;
  intervalUnit: ScheduleUnit;
  accountId: string | null;
  toAccountId: string | null;
  ownerId: string | null;
  lastSeenAt: string | Date | null;
};

export type AccountRef = { id: string; ownerId: string | null };

/** One side of an item as it lands on an account: an expense out of one, income into another. */
export type Entry<T extends BudgetItem = BudgetItem> = {
  item: T;
  side: "INCOME" | "EXPENSE";
  accountId: string | null;
  scope: ScopeKey;
};

export function scopeOfOwner(ownerId: string | null, currentUserId: string): ScopeKey {
  if (ownerId === null) return HOUSEHOLD;
  return ownerId === currentUserId ? YOU : ownerId;
}

/**
 * Where an item lands. Income and expenses land on their own account (or its
 * owner when no account is linked); a recurring transfer lands twice — as an
 * expense where it leaves and as income where it arrives. A destination the
 * viewer can't see contributes nothing.
 */
export function entriesOf<T extends BudgetItem>(
  item: T,
  accounts: Map<string, AccountRef>,
  currentUserId: string,
): Entry<T>[] {
  const source = item.accountId ? accounts.get(item.accountId) : undefined;
  const sourceOwner = source ? source.ownerId : item.ownerId;
  const entries: Entry<T>[] = [];

  if (item.type === "TRANSFER") {
    entries.push({ item, side: "EXPENSE", accountId: item.accountId, scope: scopeOfOwner(sourceOwner, currentUserId) });
    const dest = item.toAccountId ? accounts.get(item.toAccountId) : undefined;
    if (dest) {
      entries.push({ item, side: "INCOME", accountId: dest.id, scope: scopeOfOwner(dest.ownerId, currentUserId) });
    }
    return entries;
  }

  entries.push({
    item,
    side: item.type,
    accountId: item.accountId,
    scope: scopeOfOwner(sourceOwner, currentUserId),
  });
  return entries;
}

export function monthlyOf(item: BudgetItem): number {
  return monthlyEquivalent(item.amount, item.intervalCount, item.intervalUnit);
}

export function totalsOf(entries: Entry[]) {
  let income = 0;
  let expenses = 0;
  for (const e of entries) {
    if (e.side === "INCOME") income += monthlyOf(e.item);
    else expenses += monthlyOf(e.item);
  }
  return { income, expenses, left: income - expenses };
}

/** What has already come in or gone out this month, going by when each item was last seen. */
export function soFarThisMonth(entries: Entry[], today: Date) {
  const monthStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1);
  let income = 0;
  let expenses = 0;
  for (const e of entries) {
    if (!e.item.lastSeenAt || new Date(e.item.lastSeenAt).getTime() < monthStart) continue;
    // An item that comes less often than monthly isn't "this month's" money.
    if (monthlyOf(e.item) !== e.item.amount) continue;
    if (e.side === "INCOME") income += e.item.amount;
    else expenses += e.item.amount;
  }
  return { income, expenses };
}

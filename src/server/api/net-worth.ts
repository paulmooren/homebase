import type { PrismaClient } from "@prisma/client";
import { ASSET_ACCOUNT_TYPES, LIABILITY_ACCOUNT_TYPES } from "@/lib/constants";

function isLiabilityType(type: string) {
  return (LIABILITY_ACCOUNT_TYPES as readonly string[]).includes(type);
}

/**
 * Signed balance delta for one leg of a transaction. A liability account's
 * `balance` stores the amount owed (a positive magnitude), which moves the
 * *opposite* way from an asset account for the same real-world event: a card
 * charge increases what you owe, a transfer that pays down a card decreases it.
 */
export function accountDelta(
  accountType: string,
  effect: "expense" | "income" | "transferOut" | "transferIn",
  amount: number,
) {
  const assetDelta = effect === "expense" || effect === "transferOut" ? -amount : amount;
  return isLiabilityType(accountType) ? -assetDelta : assetDelta;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Single source of truth for both an account's current balance and the
 * household's net-worth history: `balance` is never incrementally mutated by
 * a transaction mutation (that double-counts once historical transactions
 * get imported on top of an already-current balance) — it's always derived
 * as `startingBalance + Σ(transaction deltas)`, recomputed fully here.
 *
 * Walks every transaction forward in date order from each account's
 * `startingBalance`, recording one whole-household snapshot per distinct
 * transaction date (so the history graph reflects real activity, not just
 * "today"), and writes back each account's final running balance as its
 * new `balance` — so editing `startingBalance` later, or importing/deleting
 * transactions, always lands on the correct number with no drift.
 */
export async function recomputeNetWorthSnapshot(prisma: PrismaClient, householdId: string) {
  const accounts = await prisma.financialAccount.findMany({
    where: { householdId },
    select: { id: true, type: true, startingBalance: true },
  });

  if (accounts.length === 0) {
    await prisma.netWorthSnapshot.deleteMany({ where: { householdId } });
    return;
  }

  const transactions = await prisma.transaction.findMany({
    where: { householdId },
    select: { accountId: true, transferToAccountId: true, type: true, amount: true, date: true },
    orderBy: { date: "asc" },
  });

  const accountType = new Map(accounts.map((a) => [a.id, a.type]));

  // Walk forward in date order from each account's starting balance,
  // applying each date's transactions and recording one household-wide
  // snapshot per distinct date.
  const runningBalance = new Map(accounts.map((a) => [a.id, Number(a.startingBalance)] as const));
  const snapshots = new Map<string, { totalAssets: number; totalLiabilities: number }>();

  function totalsFromRunningBalance() {
    let totalAssets = 0;
    let totalLiabilities = 0;
    for (const a of accounts) {
      const balance = runningBalance.get(a.id) ?? 0;
      if ((ASSET_ACCOUNT_TYPES as readonly string[]).includes(a.type)) totalAssets += balance;
      else totalLiabilities += balance;
    }
    return { totalAssets, totalLiabilities };
  }

  let i = 0;
  while (i < transactions.length) {
    const key = dateKey(transactions[i].date);
    while (i < transactions.length && dateKey(transactions[i].date) === key) {
      const t = transactions[i];
      const amount = Number(t.amount);
      const sourceEffect = t.type === "TRANSFER" ? "transferOut" : t.type === "INCOME" ? "income" : "expense";
      runningBalance.set(
        t.accountId,
        (runningBalance.get(t.accountId) ?? 0) + accountDelta(accountType.get(t.accountId)!, sourceEffect, amount),
      );
      if (t.type === "TRANSFER" && t.transferToAccountId) {
        runningBalance.set(
          t.transferToAccountId,
          (runningBalance.get(t.transferToAccountId) ?? 0) +
            accountDelta(accountType.get(t.transferToAccountId)!, "transferIn", amount),
        );
      }
      i++;
    }
    snapshots.set(key, totalsFromRunningBalance());
  }

  // Always keep today's point current, even for a household with no
  // transactions at all (accounts still have a starting balance).
  snapshots.set(dateKey(new Date()), totalsFromRunningBalance());

  await prisma.$transaction([
    ...accounts.map((a) =>
      prisma.financialAccount.update({
        where: { id: a.id },
        data: { balance: runningBalance.get(a.id) ?? 0 },
      }),
    ),
    prisma.netWorthSnapshot.deleteMany({ where: { householdId } }),
    ...Array.from(snapshots.entries()).map(([key, { totalAssets, totalLiabilities }]) =>
      prisma.netWorthSnapshot.create({
        data: {
          householdId,
          date: new Date(key),
          totalAssets,
          totalLiabilities,
          netWorth: totalAssets - totalLiabilities,
        },
      }),
    ),
  ]);
}

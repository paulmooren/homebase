import type { PrismaClient } from "@prisma/client";

import { amountWithin, cleanText, referenceOf } from "@/lib/recurring-detect";

/**
 * Links transactions to the Recurring items they are occurrences of, by the
 * other party first (IBAN), then by description with the changing numbers
 * stripped. A fixed-amount item only takes payments of about that amount, so
 * an unrelated payment to the same party isn't swept in. Each matched item
 * remembers when it was last seen.
 *
 * Only transactions not yet linked are considered, so running it again after
 * every import is cheap and never moves a transaction between items.
 */
export async function attachRecurringTransactions(prisma: PrismaClient, householdId: string, itemIds?: string[]) {
  const items = await prisma.recurringItem.findMany({
    where: {
      householdId,
      status: "ACTIVE",
      accountId: { not: null },
      ...(itemIds ? { id: { in: itemIds } } : {}),
      OR: [{ matchIban: { not: null } }, { matchText: { not: null } }, { type: "TRANSFER", toAccountId: { not: null } }],
    },
  });

  let attached = 0;
  for (const item of items) {
    const party =
      item.type === "TRANSFER"
        ? { transferToAccountId: item.toAccountId }
        : item.matchIban
          ? { counterpartyIban: item.matchIban }
          : { counterpartyIban: null };

    const candidates = await prisma.transaction.findMany({
      where: { householdId, accountId: item.accountId!, type: item.type, recurringItemId: null, ...party },
      select: { id: true, amount: true, date: true, merchant: true, counterpartyName: true },
    });

    const itemAmount = Number(item.amount);
    const matches = candidates.filter((t) => {
      if (item.matchRef && referenceOf(t.merchant) !== item.matchRef) return false;
      if (item.matchText && cleanText(t.counterpartyName || t.merchant) !== item.matchText) return false;
      return item.amountVaries || amountWithin(Number(t.amount), itemAmount);
    });
    if (matches.length === 0) continue;

    await prisma.transaction.updateMany({
      where: { id: { in: matches.map((m) => m.id) } },
      data: { recurringItemId: item.id },
    });
    const latest = matches.reduce((max, m) => (m.date > max ? m.date : max), matches[0].date);
    if (!item.lastSeenAt || latest > item.lastSeenAt) {
      await prisma.recurringItem.update({ where: { id: item.id }, data: { lastSeenAt: latest } });
    }
    attached += matches.length;
  }
  return attached;
}

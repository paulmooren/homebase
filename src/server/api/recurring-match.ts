import type { PrismaClient } from "@prisma/client";

import { onSchedule } from "@/lib/on-schedule";
import { cleanText, referenceOf } from "@/lib/recurring-detect";

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

    // The payments already linked say where the item's rhythm is. A candidate is judged against the one
    // nearest to it in time, so the rhythm can't drift over a long stretch.
    const linked = await prisma.transaction.findMany({
      where: { recurringItemId: item.id, recurringExcluded: false },
      select: { amount: true, date: true },
    });
    const nearestLinked = (date: Date) =>
      linked.reduce<(typeof linked)[number] | null>(
        (best, p) => (best === null || Math.abs(+p.date - +date) < Math.abs(+best.date - +date) ? p : best),
        null,
      );
    const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.1);
    const itemAmount = Number(item.amount);
    const matches = candidates.filter((t) => {
      if (item.matchRef && referenceOf(t.merchant) !== item.matchRef) return false;
      if (item.matchText && cleanText(t.counterpartyName || t.merchant) !== item.matchText) return false;
      const amount = Number(t.amount);

      const neighbour = nearestLinked(t.date);
      if (neighbour) {
        // Once an item has payments, WHEN decides: one on its rhythm is the next occurrence, whatever its size
        // (a changed amount is then proposed to the Member). One in the same period as a payment it already has, or
        // off the rhythm — an extra, a pass-through — is not.
        if (!onSchedule(neighbour.date, t.date, item.intervalCount, item.intervalUnit)) return false;
        const base = Number(neighbour.amount);
        return item.amountVaries || (amount >= base * 0.25 && amount <= base * 4);
      }
      // Nothing linked yet to tell the rhythm from: the amount has to carry it.
      return item.amountVaries || near(amount, itemAmount);
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

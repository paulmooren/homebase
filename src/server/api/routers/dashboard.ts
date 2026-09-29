import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, householdProcedure } from "@/server/api/trpc";
import { ASSET_ACCOUNT_TYPES } from "@/lib/constants";
import { accountDelta } from "@/server/api/net-worth";

function lastMonthRange() {
  const now = new Date();
  const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { startOfThisMonth, startOfLastMonth };
}

function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Bucket end-dates from `from` to `to` inclusive, one per unit of `granularity`. */
function buildBuckets(from: Date, to: Date, granularity: "day" | "week" | "month"): Date[] {
  const buckets: Date[] = [];
  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime()) {
    buckets.push(new Date(cursor));
    if (granularity === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (granularity === "week") cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  if (buckets.length === 0 || buckets[buckets.length - 1].getTime() !== to.getTime()) {
    buckets.push(new Date(to));
  }
  return buckets;
}

export const dashboardRouter = createTRPCRouter({
  netWorthHistory: householdProcedure
    .input(
      z.object({
        from: z.coerce.date(),
        to: z.coerce.date(),
        granularity: z.enum(["day", "week", "month"]).default("day"),
      }),
    )
    .query(async ({ ctx, input }) => {
      let from = input.from;
      let to = input.to;
      if (from.getTime() > to.getTime()) [from, to] = [to, from];
      const today = todayUTC();
      if (to.getTime() > today.getTime()) to = today;

      const snapshots = await ctx.prisma.netWorthSnapshot.findMany({
        where: { householdId: ctx.householdId, date: { lte: to } },
        orderBy: { date: "asc" },
      });
      if (snapshots.length === 0) return [];

      const buckets = buildBuckets(from, to, input.granularity);

      // Forward-fill: net worth is a balance, so "as of this bucket" is the
      // most recent known snapshot at or before it, not an average.
      const result: (typeof snapshots)[number][] = [];
      let i = 0;
      for (const bucketEnd of buckets) {
        while (i + 1 < snapshots.length && snapshots[i + 1].date.getTime() <= bucketEnd.getTime()) {
          i++;
        }
        if (snapshots[i].date.getTime() <= bucketEnd.getTime()) {
          result.push({ ...snapshots[i], date: bucketEnd });
        }
      }
      return result;
    }),

  /**
   * Balance-over-time for a single account (rather than household-wide net
   * worth) — same regular-grid forward-fill approach as `netWorthHistory`,
   * but walking one account's own ledger, including transactions where it's
   * either the source or the transfer destination.
   */
  accountHistory: householdProcedure
    .input(
      z.object({
        accountId: z.string(),
        from: z.coerce.date(),
        to: z.coerce.date(),
        granularity: z.enum(["day", "week", "month"]).default("day"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const account = await ctx.prisma.financialAccount.findFirst({
        where: {
          id: input.accountId,
          householdId: ctx.householdId,
          OR: [
            { ownerId: null },
            { ownerId: ctx.userId },
            { ownerId: { not: null }, visibleToHousehold: true },
          ],
        },
        select: { id: true, type: true, startingBalance: true },
      });
      if (!account) throw new TRPCError({ code: "NOT_FOUND" });

      let from = input.from;
      let to = input.to;
      if (from.getTime() > to.getTime()) [from, to] = [to, from];
      const today = todayUTC();
      if (to.getTime() > today.getTime()) to = today;

      const transactions = await ctx.prisma.transaction.findMany({
        where: {
          householdId: ctx.householdId,
          OR: [{ accountId: account.id }, { transferToAccountId: account.id }],
          date: { lte: to },
        },
        select: { accountId: true, transferToAccountId: true, type: true, amount: true, date: true },
        orderBy: { date: "asc" },
      });

      const buckets = buildBuckets(from, to, input.granularity);
      const result: { date: Date; balance: number }[] = [];
      let running = Number(account.startingBalance);
      let i = 0;
      for (const bucketEnd of buckets) {
        while (i < transactions.length && transactions[i].date.getTime() <= bucketEnd.getTime()) {
          const t = transactions[i];
          const amount = Number(t.amount);
          if (t.accountId === account.id) {
            const effect = t.type === "TRANSFER" ? "transferOut" : t.type === "INCOME" ? "income" : "expense";
            running += accountDelta(account.type, effect, amount);
          } else if (t.transferToAccountId === account.id) {
            running += accountDelta(account.type, "transferIn", amount);
          }
          i++;
        }
        result.push({ date: bucketEnd, balance: running });
      }
      return result;
    }),

  summary: householdProcedure.query(async ({ ctx }) => {
    // Net worth is shared/joint wealth, not "everyone's personal money added
    // together" — only shared accounts (ownerId null) count toward the
    // totals. The account list returned to the client is separately
    // visibility-filtered to shared + the viewer's own accounts, so a
    // partner's personal account never leaks into the payload either way.
    const allAccounts = await ctx.prisma.financialAccount.findMany({
      where: { householdId: ctx.householdId },
    });

    let totalAssets = 0;
    let totalLiabilities = 0;
    for (const account of allAccounts) {
      if (account.ownerId !== null) continue;
      const balance = Number(account.balance);
      if ((ASSET_ACCOUNT_TYPES as readonly string[]).includes(account.type)) {
        totalAssets += balance;
      } else {
        totalLiabilities += balance;
      }
    }

    const accounts = allAccounts.filter(
      (a) => a.ownerId === null || a.ownerId === ctx.userId || a.visibleToHousehold,
    );

    return {
      accounts,
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
    };
  }),

  missingStatements: householdProcedure.query(async ({ ctx }) => {
    const { startOfThisMonth, startOfLastMonth } = lastMonthRange();

    const accounts = await ctx.prisma.financialAccount.findMany({
      where: {
        householdId: ctx.householdId,
        OR: [{ ownerId: null }, { ownerId: ctx.userId }],
        createdAt: { lt: startOfThisMonth },
      },
      select: { id: true, name: true, type: true },
    });
    if (accounts.length === 0) return [];

    const accountIds = accounts.map((a) => a.id);
    const lastMonthTxns = await ctx.prisma.transaction.findMany({
      where: {
        date: { gte: startOfLastMonth, lt: startOfThisMonth },
        OR: [{ accountId: { in: accountIds } }, { transferToAccountId: { in: accountIds } }],
      },
      select: { accountId: true, transferToAccountId: true },
    });

    const activeAccountIds = new Set<string>();
    for (const t of lastMonthTxns) {
      activeAccountIds.add(t.accountId);
      if (t.transferToAccountId) activeAccountIds.add(t.transferToAccountId);
    }

    return accounts
      .filter((a) => !activeAccountIds.has(a.id))
      .map((a) => ({
        type: "missing_statement" as const,
        accountId: a.id,
        accountName: a.name,
        accountType: a.type,
      }));
  }),
});

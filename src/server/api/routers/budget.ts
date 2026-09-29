import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, householdProcedure } from "@/server/api/trpc";

function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

function scopeOf(ownerId: string | null) {
  return ownerId ?? "HOUSEHOLD";
}

export type BudgetStatus = "good" | "warn" | "critical";

export function budgetStatus(spent: number, monthlyAmount: number): BudgetStatus {
  if (monthlyAmount <= 0) return "good";
  const pct = (spent / monthlyAmount) * 100;
  if (pct > 100) return "critical";
  if (pct >= 90) return "warn";
  return "good";
}

export const budgetRouter = createTRPCRouter({
  list: householdProcedure.query(async ({ ctx }) => {
    const { start, end } = currentMonthRange();

    const [budgets, transactions] = await Promise.all([
      ctx.prisma.budget.findMany({
        where: {
          householdId: ctx.householdId,
          OR: [
            { ownerId: null },
            { ownerId: ctx.userId },
            { ownerId: { not: null }, visibleToHousehold: true },
          ],
        },
        include: { category: true },
      }),
      // A budget's "spent" is scoped to its own ownership: a household
      // budget only reflects shared-account spend, a personal budget only
      // that owner's account spend — same invariant as Net Worth, so
      // personal spending is never silently folded into a shared total.
      ctx.prisma.transaction.findMany({
        where: {
          householdId: ctx.householdId,
          type: "EXPENSE",
          date: { gte: start, lt: end },
          categoryId: { not: null },
        },
        select: { categoryId: true, amount: true, account: { select: { ownerId: true } } },
      }),
    ]);

    const spentMap = new Map<string, number>();
    for (const t of transactions) {
      const key = `${t.categoryId}::${scopeOf(t.account.ownerId)}`;
      spentMap.set(key, (spentMap.get(key) ?? 0) + Number(t.amount));
    }

    return budgets.map((budget) => {
      const spent = spentMap.get(`${budget.categoryId}::${budget.ownerScope}`) ?? 0;
      const monthlyAmount = Number(budget.monthlyAmount);
      return {
        id: budget.id,
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        color: budget.category.color,
        ownerId: budget.ownerId,
        visibleToHousehold: budget.visibleToHousehold,
        monthlyAmount,
        spent,
        status: budgetStatus(spent, monthlyAmount),
      };
    });
  }),

  upsert: householdProcedure
    .input(
      z.object({
        categoryId: z.string(),
        monthlyAmount: z.number().nonnegative(),
        ownerId: z.string().nullable().optional(),
        visibleToHousehold: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.prisma.category.findFirst({
        where: { id: input.categoryId, householdId: ctx.householdId },
        select: { id: true },
      });
      if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found." });

      const ownerId = input.ownerId ?? null;
      if (ownerId) {
        const isMember = await ctx.prisma.householdMember.findFirst({
          where: { householdId: ctx.householdId, userId: ownerId },
          select: { id: true },
        });
        if (!isMember) throw new TRPCError({ code: "BAD_REQUEST", message: "Not a household member." });
      }
      const ownerScope = scopeOf(ownerId);

      return ctx.prisma.budget.upsert({
        where: {
          householdId_categoryId_ownerScope: {
            householdId: ctx.householdId,
            categoryId: input.categoryId,
            ownerScope,
          },
        },
        create: {
          householdId: ctx.householdId,
          categoryId: input.categoryId,
          ownerId,
          ownerScope,
          visibleToHousehold: input.visibleToHousehold ?? true,
          monthlyAmount: input.monthlyAmount,
        },
        update: { monthlyAmount: input.monthlyAmount },
      });
    }),

  updateVisibility: householdProcedure
    .input(z.object({ id: z.string(), visibleToHousehold: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.budget.findFirst({
        where: { id: input.id, householdId: ctx.householdId, ownerId: ctx.userId },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.budget.update({
        where: { id: input.id },
        data: { visibleToHousehold: input.visibleToHousehold },
      });
    }),

  delete: householdProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.budget.findFirst({
        where: {
          id: input.id,
          householdId: ctx.householdId,
          OR: [{ ownerId: null }, { ownerId: ctx.userId }],
        },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.budget.delete({ where: { id: input.id } });
      return { success: true };
    }),
});

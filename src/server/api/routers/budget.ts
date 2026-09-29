import { z } from "zod";

import { createTRPCRouter, householdProcedure } from "@/server/api/trpc";

function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
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

    // Deliberately a whole-household aggregate (not visibility-filtered by
    // owner): a shared budget must reflect a partner's personal-account
    // spend too, or the "spent" figure is silently wrong.
    const [budgets, spentByCategory] = await Promise.all([
      ctx.prisma.budget.findMany({
        where: { householdId: ctx.householdId },
        include: { category: true },
      }),
      ctx.prisma.transaction.groupBy({
        by: ["categoryId"],
        where: {
          householdId: ctx.householdId,
          type: "EXPENSE",
          date: { gte: start, lt: end },
          categoryId: { not: null },
        },
        _sum: { amount: true },
      }),
    ]);

    const spentMap = new Map(
      spentByCategory.map((row) => [row.categoryId, Number(row._sum.amount ?? 0)]),
    );

    return budgets.map((budget) => {
      const spent = spentMap.get(budget.categoryId) ?? 0;
      const monthlyAmount = Number(budget.monthlyAmount);
      return {
        id: budget.id,
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        color: budget.category.color,
        monthlyAmount,
        spent,
        status: budgetStatus(spent, monthlyAmount),
      };
    });
  }),

  upsert: householdProcedure
    .input(z.object({ categoryId: z.string(), monthlyAmount: z.number().nonnegative() }))
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.prisma.category.findFirst({
        where: { id: input.categoryId, householdId: ctx.householdId },
        select: { id: true },
      });
      if (!category) throw new Error("Category not found.");

      return ctx.prisma.budget.upsert({
        where: {
          householdId_categoryId: { householdId: ctx.householdId, categoryId: input.categoryId },
        },
        create: {
          householdId: ctx.householdId,
          categoryId: input.categoryId,
          monthlyAmount: input.monthlyAmount,
        },
        update: { monthlyAmount: input.monthlyAmount },
      });
    }),

  delete: householdProcedure
    .input(z.object({ categoryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.budget.deleteMany({
        where: { householdId: ctx.householdId, categoryId: input.categoryId },
      });
      return { success: true };
    }),
});

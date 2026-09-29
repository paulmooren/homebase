import { z } from "zod";

import { createTRPCRouter, householdProcedure, protectedProcedure } from "@/server/api/trpc";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(({ ctx }) => {
    return ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { id: true, email: true, name: true, shareRecurringItems: true },
    });
  }),

  updateName: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(60) }))
    .mutation(({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { name: input.name },
      });
    }),

  updateSharing: protectedProcedure
    .input(z.object({ shareRecurringItems: z.boolean() }))
    .mutation(({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { shareRecurringItems: input.shareRecurringItems },
      });
    }),

  exportData: householdProcedure.query(async ({ ctx }) => {
    // Same visibility filter as account.list/transaction.list — export must
    // not become a backdoor around a partner's personal-account privacy.
    const [accounts, categories, budgets] = await Promise.all([
      ctx.prisma.financialAccount.findMany({
        where: {
          householdId: ctx.householdId,
          OR: [{ ownerId: null }, { ownerId: ctx.userId }],
        },
      }),
      ctx.prisma.category.findMany({ where: { householdId: ctx.householdId } }),
      ctx.prisma.budget.findMany({ where: { householdId: ctx.householdId } }),
    ]);
    const transactions = await ctx.prisma.transaction.findMany({
      where: { householdId: ctx.householdId, accountId: { in: accounts.map((a) => a.id) } },
    });
    return { exportedAt: new Date().toISOString(), accounts, categories, transactions, budgets };
  }),
});

import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, householdProcedure } from "@/server/api/trpc";
import { recomputeNetWorthSnapshot } from "@/server/api/net-worth";

const accountTypeSchema = z.enum([
  "CHECKING",
  "SAVINGS",
  "CREDIT_CARD",
  "CASH",
  "INVESTMENT",
  "LOAN",
  "MORTGAGE",
]);

export const accountRouter = createTRPCRouter({
  list: householdProcedure.query(({ ctx }) => {
    return ctx.prisma.financialAccount.findMany({
      where: {
        householdId: ctx.householdId,
        OR: [
          { ownerId: null },
          { ownerId: ctx.userId },
          { ownerId: { not: null }, visibleToHousehold: true },
        ],
      },
      orderBy: { createdAt: "asc" },
    });
  }),

  /**
   * Actual income and expenses per visible account for one calendar month
   * (transfers excluded — moving money between accounts isn't earning or
   * spending it). Defaults to the latest month with any activity, since
   * statements are imported after the fact and "this month" is usually empty.
   */
  monthlyFlow: householdProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const accounts = await ctx.prisma.financialAccount.findMany({
        where: {
          householdId: ctx.householdId,
          OR: [
            { ownerId: null },
            { ownerId: ctx.userId },
            { ownerId: { not: null }, visibleToHousehold: true },
          ],
        },
        select: { id: true, name: true, institution: true, type: true, ownerId: true },
        orderBy: { createdAt: "asc" },
      });
      const ids = accounts.map((a) => a.id);
      const flowTypes = ["INCOME", "EXPENSE"] as const;

      let month = input?.month;
      if (!month) {
        const latest = await ctx.prisma.transaction.aggregate({
          _max: { date: true },
          where: { accountId: { in: ids }, type: { in: [...flowTypes] } },
        });
        const d = latest._max.date ?? new Date();
        month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      }

      const [year, mon] = month.split("-").map(Number);
      const start = new Date(Date.UTC(year, mon - 1, 1));
      const end = new Date(Date.UTC(year, mon, 1));

      const sums = await ctx.prisma.transaction.groupBy({
        by: ["accountId", "type"],
        where: {
          householdId: ctx.householdId,
          accountId: { in: ids },
          type: { in: [...flowTypes] },
          date: { gte: start, lt: end },
        },
        _sum: { amount: true },
      });

      const total = (accountId: string, type: (typeof flowTypes)[number]) =>
        Number(sums.find((r) => r.accountId === accountId && r.type === type)?._sum.amount ?? 0);

      return {
        month,
        accounts: accounts.map((a) => ({
          ...a,
          income: total(a.id, "INCOME"),
          expenses: total(a.id, "EXPENSE"),
        })),
      };
    }),

  create: householdProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80),
        institution: z.string().max(80).optional(),
        type: accountTypeSchema,
        startingBalance: z.number().finite(),
        ownerId: z.string().nullable().optional(),
        visibleToHousehold: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.ownerId) {
        const isMember = await ctx.prisma.householdMember.findFirst({
          where: { householdId: ctx.householdId, userId: input.ownerId },
          select: { id: true },
        });
        if (!isMember) throw new TRPCError({ code: "BAD_REQUEST", message: "Not a household member." });
      }

      const account = await ctx.prisma.financialAccount.create({
        data: {
          householdId: ctx.householdId,
          ownerId: input.ownerId ?? null,
          visibleToHousehold: input.visibleToHousehold ?? true,
          name: input.name,
          institution: input.institution,
          type: input.type,
          startingBalance: input.startingBalance,
          // No transactions yet, so the live balance starts out equal to it.
          balance: input.startingBalance,
        },
      });
      await recomputeNetWorthSnapshot(ctx.prisma, ctx.householdId);
      return account;
    }),

  update: householdProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(80).optional(),
        institution: z.string().max(80).optional(),
        type: accountTypeSchema.optional(),
        startingBalance: z.number().finite().optional(),
        ownerId: z.string().nullable().optional(),
        visibleToHousehold: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ownerId, ...data } = input;

      if (ownerId) {
        const isMember = await ctx.prisma.householdMember.findFirst({
          where: { householdId: ctx.householdId, userId: ownerId },
          select: { id: true },
        });
        if (!isMember) throw new TRPCError({ code: "BAD_REQUEST", message: "Not a household member." });
      }

      const existing = await ctx.prisma.financialAccount.findFirst({
        where: {
          id,
          householdId: ctx.householdId,
          OR: [{ ownerId: null }, { ownerId: ctx.userId }],
        },
        select: { id: true, ownerId: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (data.visibleToHousehold !== undefined && existing.ownerId === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Shared accounts are always visible — visibility only applies to personal accounts.",
        });
      }

      const account = await ctx.prisma.financialAccount.update({
        where: { id },
        data: { ...data, ...(ownerId !== undefined ? { ownerId } : {}) },
      });
      if (data.startingBalance !== undefined || data.type !== undefined) {
        await recomputeNetWorthSnapshot(ctx.prisma, ctx.householdId);
      }
      return account;
    }),

  delete: householdProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.financialAccount.findFirst({
        where: {
          id: input.id,
          householdId: ctx.householdId,
          OR: [{ ownerId: null }, { ownerId: ctx.userId }],
        },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.financialAccount.delete({ where: { id: input.id } });
      await recomputeNetWorthSnapshot(ctx.prisma, ctx.householdId);
      return { success: true };
    }),
});

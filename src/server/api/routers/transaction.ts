import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, householdProcedure } from "@/server/api/trpc";
import { recomputeNetWorthSnapshot } from "@/server/api/net-worth";
import { suggestCategoryId } from "@/lib/categorize";

export const transactionRouter = createTRPCRouter({
  list: householdProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        accountId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // A specific account must itself be one the caller may see — without
      // this, any account id (including a partner's private one) would list.
      if (input.accountId) {
        const visible = await ctx.prisma.financialAccount.findFirst({
          where: {
            id: input.accountId,
            householdId: ctx.householdId,
            OR: [
              { ownerId: null },
              { ownerId: ctx.userId },
              { ownerId: { not: null }, visibleToHousehold: true },
            ],
          },
          select: { id: true },
        });
        if (!visible) throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.prisma.transaction.findMany({
        where: {
          householdId: ctx.householdId,
          // Filtering to one account means either leg of a transfer counts —
          // an incoming transfer is part of that account's own history too.
          ...(input.accountId
            ? { OR: [{ accountId: input.accountId }, { transferToAccountId: input.accountId }] }
            : {
                account: {
                  OR: [
                    { ownerId: null },
                    { ownerId: ctx.userId },
                    { ownerId: { not: null }, visibleToHousehold: true },
                  ],
                },
              }),
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: input.limit,
        include: { category: true, account: true, transferToAccount: true },
      });
    }),

  create: householdProcedure
    .input(
      z.object({
        accountId: z.string(),
        type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
        amount: z.number().positive(),
        date: z.coerce.date(),
        merchant: z.string().min(1).max(120),
        note: z.string().max(280).optional(),
        categoryId: z.string().optional(),
        transferToAccountId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.type === "TRANSFER") {
        if (!input.transferToAccountId || input.transferToAccountId === input.accountId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A transfer needs a different destination account.",
          });
        }
      }

      const accountIds = [input.accountId, input.transferToAccountId].filter(
        (id): id is string => Boolean(id),
      );
      const visibleAccounts = await ctx.prisma.financialAccount.findMany({
        where: {
          id: { in: accountIds },
          householdId: ctx.householdId,
          OR: [{ ownerId: null }, { ownerId: ctx.userId }],
        },
        select: { id: true },
      });
      if (visibleAccounts.length !== accountIds.length) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const transaction = await ctx.prisma.transaction.create({
        data: {
          householdId: ctx.householdId,
          accountId: input.accountId,
          type: input.type,
          amount: input.amount,
          date: input.date,
          merchant: input.merchant,
          note: input.note,
          categoryId: input.type === "TRANSFER" ? null : input.categoryId,
          transferToAccountId: input.type === "TRANSFER" ? input.transferToAccountId : null,
        },
      });

      await recomputeNetWorthSnapshot(ctx.prisma, ctx.householdId);
      return transaction;
    }),

  update: householdProcedure
    .input(z.object({ id: z.string(), categoryId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.transaction.findFirst({
        where: {
          id: input.id,
          householdId: ctx.householdId,
          account: { OR: [{ ownerId: null }, { ownerId: ctx.userId }] },
        },
        select: { id: true, type: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.type === "TRANSFER") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transfers can't have a category." });
      }

      return ctx.prisma.transaction.update({
        where: { id: input.id },
        data: { categoryId: input.categoryId },
      });
    }),

  delete: householdProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.transaction.findFirst({
        where: {
          id: input.id,
          householdId: ctx.householdId,
          account: { OR: [{ ownerId: null }, { ownerId: ctx.userId }] },
        },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.transaction.delete({ where: { id: input.id } });
      await recomputeNetWorthSnapshot(ctx.prisma, ctx.householdId);
      return { success: true };
    }),

  removeAll: householdProcedure.mutation(async ({ ctx }) => {
    const transactions = await ctx.prisma.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        account: { OR: [{ ownerId: null }, { ownerId: ctx.userId }] },
      },
      select: { id: true },
    });
    if (transactions.length === 0) return { deleted: 0 };

    await ctx.prisma.transaction.deleteMany({
      where: { id: { in: transactions.map((t) => t.id) } },
    });
    await recomputeNetWorthSnapshot(ctx.prisma, ctx.householdId);
    return { deleted: transactions.length };
  }),

  importCsv: householdProcedure
    .input(
      z.object({
        accountId: z.string(),
        rows: z
          .array(
            z.object({
              date: z.coerce.date(),
              merchant: z.string().min(1).max(120),
              amount: z.number().finite(),
              categoryId: z.string().optional(),
            }),
          )
          .min(1)
          .max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.prisma.financialAccount.findFirst({
        where: {
          id: input.accountId,
          householdId: ctx.householdId,
          OR: [{ ownerId: null }, { ownerId: ctx.userId }],
        },
        select: { id: true },
      });
      if (!account) throw new TRPCError({ code: "NOT_FOUND" });

      const categories = await ctx.prisma.category.findMany({
        where: { householdId: ctx.householdId },
        select: { id: true, name: true },
      });

      const rows = input.rows.map((row) => {
        // Convention (matches manual entry): negative = money-out (expense), positive = money-in (income).
        const type = row.amount < 0 ? ("EXPENSE" as const) : ("INCOME" as const);
        return {
          householdId: ctx.householdId,
          accountId: input.accountId,
          type,
          amount: Math.abs(row.amount),
          date: row.date,
          merchant: row.merchant,
          categoryId: row.categoryId ?? suggestCategoryId(row.merchant, categories),
        };
      });

      await ctx.prisma.transaction.createMany({ data: rows });
      await recomputeNetWorthSnapshot(ctx.prisma, ctx.householdId);
      return { imported: rows.length };
    }),
});

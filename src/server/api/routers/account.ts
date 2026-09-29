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
        OR: [{ ownerId: null }, { ownerId: ctx.userId }],
      },
      orderBy: { createdAt: "asc" },
    });
  }),

  create: householdProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80),
        institution: z.string().max(80).optional(),
        type: accountTypeSchema,
        startingBalance: z.number().finite(),
        ownerId: z.string().nullable().optional(),
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
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

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

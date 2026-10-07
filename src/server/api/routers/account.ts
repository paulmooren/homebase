import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, householdProcedure } from "@/server/api/trpc";
import { recomputeNetWorthSnapshot } from "@/server/api/net-worth";
import { normalizeIban } from "@/lib/csv";
import type { PrismaClient } from "@prisma/client";

/** A valid IBAN no other account in the household has, or null to clear it. */
async function resolveIban(
  ctx: { prisma: PrismaClient; householdId: string },
  raw: string | null | undefined,
  selfId?: string,
) {
  if (!raw?.trim()) return null;
  const iban = normalizeIban(raw);
  if (!iban) throw new TRPCError({ code: "BAD_REQUEST", message: "That doesn't look like a valid IBAN." });
  const clash = await ctx.prisma.financialAccount.findFirst({
    where: { householdId: ctx.householdId, iban, ...(selfId ? { id: { not: selfId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new TRPCError({ code: "BAD_REQUEST", message: "Another account already has this IBAN." });
  return iban;
}

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

  create: householdProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80),
        institution: z.string().max(80).optional(),
        iban: z.string().max(60).nullish(),
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

      const iban = await resolveIban(ctx, input.iban);

      const account = await ctx.prisma.financialAccount.create({
        data: {
          householdId: ctx.householdId,
          iban,
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
        iban: z.string().max(60).nullish(),
        type: accountTypeSchema.optional(),
        startingBalance: z.number().finite().optional(),
        ownerId: z.string().nullable().optional(),
        visibleToHousehold: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ownerId, iban: ibanInput, ...data } = input;

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
        data: {
          ...data,
          ...(ownerId !== undefined ? { ownerId } : {}),
          ...(ibanInput !== undefined ? { iban: await resolveIban(ctx, ibanInput, id) } : {}),
        },
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

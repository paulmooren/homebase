import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

import { createTRPCRouter, householdProcedure } from "@/server/api/trpc";
import { detectRecurringCandidates, nextOccurrence } from "@/lib/recurring";

const frequencySchema = z.enum(["WEEKLY", "MONTHLY", "YEARLY"]);

const candidateInput = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["EXPENSE", "INCOME"]),
  amount: z.number().positive(),
  frequency: frequencySchema,
  categoryId: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  visibleToHousehold: z.boolean().optional(),
});

type Ctx = { prisma: PrismaClient; householdId: string; userId: string };

/**
 * An item linked to an account belongs to that account's owner — so the owner
 * is derived from the account, never trusted from the client. Only accounts
 * the caller may edit (own or shared) can be linked.
 */
async function resolveAccountOwner(
  ctx: Ctx,
  accountId: string | null | undefined,
): Promise<{ accountId: string; ownerId: string | null } | null> {
  if (!accountId) return null;
  const account = await ctx.prisma.financialAccount.findFirst({
    where: {
      id: accountId,
      householdId: ctx.householdId,
      OR: [{ ownerId: null }, { ownerId: ctx.userId }],
    },
    select: { id: true, ownerId: true },
  });
  if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
  return { accountId: account.id, ownerId: account.ownerId };
}

function normalize(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export const recurringRouter = createTRPCRouter({
  list: householdProcedure.query(async ({ ctx }) => {
    const items = await ctx.prisma.recurringItem.findMany({
      where: {
        householdId: ctx.householdId,
        status: "ACTIVE",
        OR: [
          { ownerId: null },
          { ownerId: ctx.userId },
          { ownerId: { not: null }, visibleToHousehold: true },
        ],
      },
      include: { category: true },
      orderBy: { createdAt: "asc" },
    });
    return items.map((item) => ({
      ...item,
      amount: Number(item.amount),
      nextDueDate: item.lastSeenAt ? nextOccurrence(item.lastSeenAt, item.frequency) : null,
    }));
  }),

  suggestions: householdProcedure.query(async ({ ctx }) => {
    // Suggestions are drafts, not confirmed facts about anyone's finances —
    // never shown cross-partner, regardless of the source account's own
    // visibility. Nothing is shared until consciously confirmed into a
    // real RecurringItem (which then gets its own visibleToHousehold).
    const [transactions, existing] = await Promise.all([
      ctx.prisma.transaction.findMany({
        where: {
          householdId: ctx.householdId,
          type: { in: ["EXPENSE", "INCOME"] },
          account: { OR: [{ ownerId: null }, { ownerId: ctx.userId }] },
        },
        select: {
          merchant: true,
          type: true,
          amount: true,
          date: true,
          categoryId: true,
          accountId: true,
          account: { select: { ownerId: true } },
        },
      }),
      ctx.prisma.recurringItem.findMany({
        where: { householdId: ctx.householdId },
        select: { name: true, detectedName: true },
      }),
    ]);

    // An item hides its suggestion under its current name *and* under the
    // merchant text it was detected from — otherwise renaming a confirmed
    // item makes the original suggestion reappear.
    const knownNames = new Set(
      existing.flatMap((e) => [e.name, e.detectedName].filter((n): n is string => !!n).map(normalize)),
    );

    const candidates = detectRecurringCandidates(
      transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
        ownerId: t.account.ownerId,
      })),
    );

    return candidates.filter((c) => !knownNames.has(normalize(c.name)));
  }),

  create: householdProcedure
    .input(
      candidateInput.extend({
        // When marking a transaction as recurring: the merchant text it came from
        // (so the same suggestion doesn't pop up again) and its date (so the
        // next due date counts from it, not from today).
        detectedName: z.string().max(120).optional(),
        lastDate: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
    const linked = await resolveAccountOwner(ctx, input.accountId);
    if (!linked && input.ownerId) {
      const isMember = await ctx.prisma.householdMember.findFirst({
        where: { householdId: ctx.householdId, userId: input.ownerId },
        select: { id: true },
      });
      if (!isMember) throw new TRPCError({ code: "BAD_REQUEST", message: "Not a household member." });
    }

    try {
      return await ctx.prisma.recurringItem.create({
        data: {
          householdId: ctx.householdId,
          ownerId: linked ? linked.ownerId : (input.ownerId ?? null),
          accountId: linked?.accountId ?? null,
          visibleToHousehold: input.visibleToHousehold ?? true,
          name: input.name,
          detectedName: input.detectedName ?? null,
          type: input.type,
          amount: input.amount,
          frequency: input.frequency,
          categoryId: input.categoryId ?? null,
          source: "MANUAL",
          status: "ACTIVE",
          lastSeenAt: input.lastDate ?? new Date(),
        },
      });
    } catch {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A recurring item with this name already exists.",
      });
    }
  }),

  confirmSuggestion: householdProcedure
    .input(candidateInput.extend({ lastDate: z.coerce.date() }))
    .mutation(async ({ ctx, input }) => {
      const linked = await resolveAccountOwner(ctx, input.accountId);
      return ctx.prisma.recurringItem.upsert({
        where: { householdId_name: { householdId: ctx.householdId, name: input.name } },
        create: {
          householdId: ctx.householdId,
          ownerId: linked ? linked.ownerId : (input.ownerId ?? null),
          accountId: linked?.accountId ?? null,
          visibleToHousehold: input.visibleToHousehold ?? true,
          name: input.name,
          detectedName: input.name,
          type: input.type,
          amount: input.amount,
          frequency: input.frequency,
          categoryId: input.categoryId ?? null,
          source: "DETECTED",
          status: "ACTIVE",
          lastSeenAt: input.lastDate,
        },
        update: { status: "ACTIVE", lastSeenAt: input.lastDate },
      });
    }),

  dismissSuggestion: householdProcedure
    .input(candidateInput.extend({ lastDate: z.coerce.date() }))
    .mutation(async ({ ctx, input }) => {
      const linked = await resolveAccountOwner(ctx, input.accountId);
      return ctx.prisma.recurringItem.upsert({
        where: { householdId_name: { householdId: ctx.householdId, name: input.name } },
        create: {
          householdId: ctx.householdId,
          ownerId: linked ? linked.ownerId : (input.ownerId ?? null),
          accountId: linked?.accountId ?? null,
          visibleToHousehold: input.visibleToHousehold ?? true,
          name: input.name,
          detectedName: input.name,
          type: input.type,
          amount: input.amount,
          frequency: input.frequency,
          categoryId: input.categoryId ?? null,
          source: "DETECTED",
          status: "DISMISSED",
          lastSeenAt: input.lastDate,
        },
        update: { status: "DISMISSED" },
      });
    }),

  update: householdProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(120).optional(),
        amount: z.number().positive().optional(),
        frequency: frequencySchema.optional(),
        categoryId: z.string().nullable().optional(),
        ownerId: z.string().nullable().optional(),
        accountId: z.string().nullable().optional(),
        visibleToHousehold: z.boolean().optional(),
        status: z.enum(["ACTIVE", "CANCELLED"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, accountId, ownerId: inputOwnerId, ...data } = input;
      let ownerId = inputOwnerId;
      // Linking to an account moves the item to that account's owner;
      // unlinking (null) leaves the owner as it was unless one is passed.
      const linked = await resolveAccountOwner(ctx, accountId);
      if (linked) ownerId = linked.ownerId;

      if (ownerId) {
        const isMember = await ctx.prisma.householdMember.findFirst({
          where: { householdId: ctx.householdId, userId: ownerId },
          select: { id: true },
        });
        if (!isMember) throw new TRPCError({ code: "BAD_REQUEST", message: "Not a household member." });
      }

      const existing = await ctx.prisma.recurringItem.findFirst({
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
          message: "Shared items are always visible — visibility only applies to personal items.",
        });
      }

      return ctx.prisma.recurringItem.update({
        where: { id },
        data: {
          ...data,
          ...(ownerId !== undefined ? { ownerId } : {}),
          ...(accountId !== undefined ? { accountId: linked?.accountId ?? null } : {}),
        },
      });
    }),

  delete: householdProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.recurringItem.findFirst({
        where: {
          id: input.id,
          householdId: ctx.householdId,
          OR: [{ ownerId: null }, { ownerId: ctx.userId }],
        },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.recurringItem.delete({ where: { id: input.id } });
      return { success: true };
    }),
});

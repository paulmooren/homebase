import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

import { createTRPCRouter, householdProcedure } from "@/server/api/trpc";
import { nextOccurrence } from "@/lib/recurring";
import { BASES, amountForBasis, reviewAmount } from "@/lib/budget-basis";
import { cleanText, detectRecurring, type DetectedItem } from "@/lib/recurring-detect";
import { attachRecurringTransactions } from "@/server/api/recurring-match";

const intervalUnitSchema = z.enum(["DAY", "WEEK", "MONTH", "YEAR"]);
const basisSchema = z.enum(BASES as [typeof BASES[number], ...typeof BASES[number][]]);

const itemInput = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
  amount: z.number().positive(),
  intervalCount: z.number().int().min(1).max(365).default(1),
  intervalUnit: intervalUnitSchema.default("MONTH"),
  amountVaries: z.boolean().optional(),
  categoryId: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  // A transfer's destination account.
  toAccountId: z.string().nullable().optional(),
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

/** Any account in the household can be a transfer's destination, not only ones you can edit. */
async function assertHouseholdAccount(ctx: Ctx, accountId: string | null | undefined) {
  if (!accountId) return;
  const found = await ctx.prisma.financialAccount.findFirst({
    where: { id: accountId, householdId: ctx.householdId },
    select: { id: true },
  });
  if (!found) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
}

function normalize(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The Payments of each item, oldest first. `counted` leaves out the ones set aside. */
async function paymentsByItem(ctx: Ctx, itemIds: string[]) {
  const rows = await ctx.prisma.transaction.findMany({
    where: { householdId: ctx.householdId, recurringItemId: { in: itemIds } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: { id: true, recurringItemId: true, amount: true, date: true, merchant: true, recurringExcluded: true },
  });
  const byItem = new Map<string, { id: string; amount: number; date: Date; merchant: string; excluded: boolean }[]>();
  for (const r of rows) {
    const list = byItem.get(r.recurringItemId!) ?? [];
    list.push({ id: r.id, amount: Number(r.amount), date: r.date, merchant: r.merchant, excluded: r.recurringExcluded });
    byItem.set(r.recurringItemId!, list);
  }
  return byItem;
}

/** An item the caller may edit (own or Shared), or a NOT_FOUND. */
async function editableItem(ctx: Ctx, id: string) {
  const item = await ctx.prisma.recurringItem.findFirst({
    where: { id, householdId: ctx.householdId, OR: [{ ownerId: null }, { ownerId: ctx.userId }] },
  });
  if (!item) throw new TRPCError({ code: "NOT_FOUND" });
  return item;
}

/** Detects over everything the caller may edit (own accounts and Shared). */
async function detectFor(ctx: Ctx): Promise<DetectedItem[]> {
  const [transactions, accounts] = await Promise.all([
    ctx.prisma.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        recurringItemId: null,
        account: { OR: [{ ownerId: null }, { ownerId: ctx.userId }] },
      },
      select: {
        id: true,
        accountId: true,
        type: true,
        amount: true,
        date: true,
        merchant: true,
        counterpartyIban: true,
        counterpartyName: true,
        categoryId: true,
        transferToAccountId: true,
        account: { select: { ownerId: true } },
      },
    }),
    ctx.prisma.financialAccount.findMany({ where: { householdId: ctx.householdId }, select: { id: true, name: true } }),
  ]);
  return detectRecurring(
    transactions.map(({ account, ...t }) => ({ ...t, amount: Number(t.amount), ownerId: account.ownerId })),
    new Map(accounts.map((a) => [a.id, a.name])),
  );
}

/** Suggestions not already added or rejected (those are remembered by their match key). */
async function openSuggestions(ctx: Ctx) {
  const [detected, existing] = await Promise.all([
    detectFor(ctx),
    ctx.prisma.recurringItem.findMany({
      where: { householdId: ctx.householdId },
      select: { name: true, detectedName: true, matchKey: true },
    }),
  ]);
  const keys = new Set(existing.map((e) => e.matchKey).filter((k): k is string => !!k));
  // Items made by hand carry no key; they hide a suggestion of the same name.
  const names = new Set(
    existing.flatMap((e) => (e.matchKey ? [] : [e.name, e.detectedName])).filter((n): n is string => !!n).map(normalize),
  );
  return detected.filter((d) => !keys.has(d.matchKey) && !names.has(normalize(d.name)));
}

/** A name no other item in the household has: "FNZ Bank SE", then "FNZ Bank SE · €500", then numbered. */
function uniqueName(base: string, amount: number, taken: Set<string>) {
  const candidates = [base, `${base} · €${Math.round(amount)}`];
  for (const c of candidates) if (!taken.has(normalize(c))) return c;
  let n = 2;
  while (taken.has(normalize(`${candidates[1]} (${n})`))) n++;
  return `${candidates[1]} (${n})`;
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
    const payments = await paymentsByItem(ctx, items.map((i) => i.id));
    return items.map((item) => {
      const counted = (payments.get(item.id) ?? []).filter((p) => !p.excluded).map((p) => p.amount);
      const amount = Number(item.amount);
      const keptAmount = item.keptAmount === null ? null : Number(item.keptAmount);
      return {
        ...item,
        amount,
        keptAmount,
        paymentCount: counted.length,
        ...reviewAmount({ basis: item.basis, amount, keptAmount, payments: counted }),
        nextDueDate: item.lastSeenAt ? nextOccurrence(item.lastSeenAt, item.intervalCount, item.intervalUnit) : null,
      };
    });
  }),

  /** Everything the history panel shows: every Payment (set-aside ones included) and the item itself. */
  history: householdProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const item = await ctx.prisma.recurringItem.findFirst({
      where: {
        id: input.id,
        householdId: ctx.householdId,
        OR: [{ ownerId: null }, { ownerId: ctx.userId }, { ownerId: { not: null }, visibleToHousehold: true }],
      },
    });
    if (!item) throw new TRPCError({ code: "NOT_FOUND" });
    const payments = (await paymentsByItem(ctx, [item.id])).get(item.id) ?? [];
    return {
      id: item.id,
      name: item.name,
      basis: item.basis,
      amount: Number(item.amount),
      intervalCount: item.intervalCount,
      intervalUnit: item.intervalUnit,
      canEdit: item.ownerId === null || item.ownerId === ctx.userId,
      payments,
    };
  }),

  /** Picks how the Budgeted amount is taken. A derived basis applies its figure now; Fixed takes the typed amount. */
  setBasis: householdProcedure
    .input(z.object({ id: z.string(), basis: basisSchema, amount: z.number().positive().optional() }))
    .mutation(async ({ ctx, input }) => {
      await editableItem(ctx, input.id);
      let amount = input.amount;
      if (input.basis !== "FIXED") {
        const payments = (await paymentsByItem(ctx, [input.id])).get(input.id) ?? [];
        amount = amountForBasis(input.basis, payments.filter((p) => !p.excluded).map((p) => p.amount)) ?? undefined;
        if (amount === undefined) throw new TRPCError({ code: "BAD_REQUEST", message: "There are no payments to take an amount from." });
      } else if (amount === undefined) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enter the amount to use." });
      }
      return ctx.prisma.recurringItem.update({
        where: { id: input.id },
        data: { basis: input.basis, amount, keptAmount: null },
      });
    }),

  /** "Update": take the proposed amount. */
  acceptProposal: householdProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const item = await editableItem(ctx, input.id);
    const payments = (await paymentsByItem(ctx, [item.id])).get(item.id) ?? [];
    const { proposal } = reviewAmount({
      basis: item.basis,
      amount: Number(item.amount),
      keptAmount: item.keptAmount === null ? null : Number(item.keptAmount),
      payments: payments.filter((p) => !p.excluded).map((p) => p.amount),
    });
    if (proposal === null) return item;
    return ctx.prisma.recurringItem.update({ where: { id: item.id }, data: { amount: proposal, keptAmount: null } });
  }),

  /** "Keep": stay on the current amount, and don't ask about this proposed figure again. */
  keepAmount: householdProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const item = await editableItem(ctx, input.id);
    const payments = (await paymentsByItem(ctx, [item.id])).get(item.id) ?? [];
    const { proposal } = reviewAmount({
      basis: item.basis,
      amount: Number(item.amount),
      keptAmount: item.keptAmount === null ? null : Number(item.keptAmount),
      payments: payments.filter((p) => !p.excluded).map((p) => p.amount),
    });
    if (proposal === null) return item;
    return ctx.prisma.recurringItem.update({ where: { id: item.id }, data: { keptAmount: proposal } });
  }),

  /** Sets a one-off Payment aside (or takes it back). It stays linked, so an import never links it again. */
  setPaymentExcluded: householdProcedure
    .input(z.object({ transactionId: z.string(), excluded: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const tx = await ctx.prisma.transaction.findFirst({
        where: { id: input.transactionId, householdId: ctx.householdId, recurringItemId: { not: null } },
        select: { recurringItemId: true },
      });
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });
      await editableItem(ctx, tx.recurringItemId!);
      await ctx.prisma.transaction.update({ where: { id: input.transactionId }, data: { recurringExcluded: input.excluded } });
      return { success: true };
    }),

  suggestions: householdProcedure.query(async ({ ctx }) => {
    // Suggestions are drafts, not confirmed facts about anyone's finances —
    // never shown cross-partner, regardless of the source account's own
    // visibility. Nothing is shared until consciously confirmed into a
    // real RecurringItem (which then gets its own visibleToHousehold).
    const open = await openSuggestions(ctx);
    // How a pattern is recognised stays on the server; the client only needs to name which it picks.
    return open.map((c) => ({
      matchKey: c.matchKey,
      name: c.name,
      type: c.type,
      amount: c.amount,
      amountVaries: c.amountVaries,
      intervalCount: c.intervalCount,
      intervalUnit: c.intervalUnit,
      occurrences: c.occurrences,
      lastDate: c.lastDate,
      confident: c.confident,
      ownerId: c.ownerId,
      accountId: c.accountId,
      nextDueDate: nextOccurrence(c.lastDate, c.intervalCount, c.intervalUnit),
    }));
  }),

  /** Adds the chosen suggestions in one go. Detection is re-run here, so the client only names what it picked. */
  addSuggestions: householdProcedure
    .input(z.object({ matchKeys: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const chosen = (await openSuggestions(ctx)).filter((d) => input.matchKeys.includes(d.matchKey));
      if (chosen.length === 0) return { added: 0 };

      const [existing, accounts] = await Promise.all([
        ctx.prisma.recurringItem.findMany({ where: { householdId: ctx.householdId }, select: { name: true } }),
        ctx.prisma.financialAccount.findMany({
          where: { householdId: ctx.householdId },
          select: { id: true, visibleToHousehold: true },
        }),
      ]);
      const taken = new Set(existing.map((e) => normalize(e.name)));
      const visibility = new Map(accounts.map((a) => [a.id, a.visibleToHousehold]));

      for (const d of chosen) {
        const name = uniqueName(d.name, d.amount, taken);
        taken.add(normalize(name));
        const item = await ctx.prisma.recurringItem.create({
          data: {
            householdId: ctx.householdId,
            ownerId: d.ownerId,
            accountId: d.accountId,
            toAccountId: d.toAccountId,
            visibleToHousehold: visibility.get(d.accountId) ?? true,
            name,
            type: d.type,
            amount: d.amount,
            amountVaries: d.amountVaries,
            intervalCount: d.intervalCount,
            intervalUnit: d.intervalUnit,
            categoryId: d.type === "TRANSFER" ? null : d.categoryId,
            matchIban: d.matchIban,
            matchText: d.matchText,
            matchRef: d.matchRef,
            matchKey: d.matchKey,
            source: "DETECTED",
            status: "ACTIVE",
            lastSeenAt: d.lastDate,
          },
        });
        await ctx.prisma.transaction.updateMany({
          where: { id: { in: d.transactionIds } },
          data: { recurringItemId: item.id },
        });
      }
      // Payments the detection set aside as a different size still belong if they fit.
      await attachRecurringTransactions(ctx.prisma, ctx.householdId);
      return { added: chosen.length };
    }),

  /** "Not recurring": remembered, so the same pattern is never suggested again. */
  dismissSuggestions: householdProcedure
    .input(z.object({ matchKeys: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const chosen = (await openSuggestions(ctx)).filter((d) => input.matchKeys.includes(d.matchKey));
      for (const d of chosen) {
        await ctx.prisma.recurringItem.create({
          data: {
            householdId: ctx.householdId,
            ownerId: d.ownerId,
            accountId: d.accountId,
            toAccountId: d.toAccountId,
            name: `dismissed:${d.matchKey}`,
            type: d.type,
            amount: d.amount,
            intervalCount: d.intervalCount,
            intervalUnit: d.intervalUnit,
            matchIban: d.matchIban,
            matchText: d.matchText,
            matchRef: d.matchRef,
            matchKey: d.matchKey,
            source: "DETECTED",
            status: "DISMISSED",
            lastSeenAt: d.lastDate,
          },
        });
      }
      return { dismissed: chosen.length };
    }),

  create: householdProcedure
    .input(
      itemInput.extend({
        // When marking a transaction as recurring: that transaction teaches the
        // item how to recognise the others (by the other party, else its text),
        // and its date is where the next due date counts from.
        fromTransactionId: z.string().optional(),
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
      if (input.type === "TRANSFER") {
        if (!linked || !input.toAccountId || input.toAccountId === linked.accountId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A recurring transfer needs two different accounts." });
        }
        await assertHouseholdAccount(ctx, input.toAccountId);
      }

      let matchIban: string | null = null;
      let matchText: string | null = null;
      if (input.fromTransactionId && input.type !== "TRANSFER") {
        const source = await ctx.prisma.transaction.findFirst({
          where: { id: input.fromTransactionId, householdId: ctx.householdId },
          select: { counterpartyIban: true, counterpartyName: true, merchant: true },
        });
        if (source?.counterpartyIban) matchIban = source.counterpartyIban;
        else if (source) matchText = cleanText(source.counterpartyName || source.merchant) || null;
      }

      let item;
      try {
        item = await ctx.prisma.recurringItem.create({
          data: {
            householdId: ctx.householdId,
            ownerId: linked ? linked.ownerId : (input.ownerId ?? null),
            accountId: linked?.accountId ?? null,
            toAccountId: input.type === "TRANSFER" ? input.toAccountId : null,
            visibleToHousehold: input.visibleToHousehold ?? true,
            name: input.name,
            type: input.type,
            amount: input.amount,
            amountVaries: input.amountVaries ?? false,
            // Marked from a transaction: follow the payments. Typed in by hand: that amount stays.
            basis: input.fromTransactionId ? "LATEST" : "FIXED",
            intervalCount: input.intervalCount,
            intervalUnit: input.intervalUnit,
            categoryId: input.categoryId ?? null,
            matchIban,
            matchText,
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
      await attachRecurringTransactions(ctx.prisma, ctx.householdId, [item.id]);
      return item;
    }),

  update: householdProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(120).optional(),
        amount: z.number().positive().optional(),
        intervalCount: z.number().int().min(1).max(365).optional(),
        intervalUnit: intervalUnitSchema.optional(),
        amountVaries: z.boolean().optional(),
        categoryId: z.string().nullable().optional(),
        ownerId: z.string().nullable().optional(),
        accountId: z.string().nullable().optional(),
        toAccountId: z.string().nullable().optional(),
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
      await assertHouseholdAccount(ctx, data.toAccountId);

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

      const updated = await ctx.prisma.recurringItem.update({
        where: { id },
        data: {
          ...data,
          // Typing an amount means "use this one".
          ...(data.amount !== undefined ? { basis: "FIXED" as const, keptAmount: null } : {}),
          ...(ownerId !== undefined ? { ownerId } : {}),
          ...(accountId !== undefined ? { accountId: linked?.accountId ?? null } : {}),
        },
      });
      if (data.amount !== undefined || accountId !== undefined) {
        await attachRecurringTransactions(ctx.prisma, ctx.householdId, [id]);
      }
      return updated;
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
      // Payments set aside belong to nobody once the item is gone.
      await ctx.prisma.transaction.updateMany({ where: { recurringItemId: input.id }, data: { recurringExcluded: false } });
      await ctx.prisma.recurringItem.delete({ where: { id: input.id } });
      return { success: true };
    }),
});

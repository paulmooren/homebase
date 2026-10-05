import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

import { createTRPCRouter, householdProcedure } from "@/server/api/trpc";

type Ctx = { prisma: PrismaClient; householdId: string; userId: string };

/** A list is yours to see and edit if it is Shared (no owner) or you own it. */
const visibleLists = (ctx: Ctx) => ({
  householdId: ctx.householdId,
  OR: [{ ownerId: null }, { ownerId: ctx.userId }],
});

async function requireList(ctx: Ctx, listId: string) {
  const list = await ctx.prisma.shoppingList.findFirst({
    where: { id: listId, ...visibleLists(ctx) },
    select: { id: true, ownerId: true },
  });
  if (!list) throw new TRPCError({ code: "NOT_FOUND" });
  return list;
}

async function requireItem(ctx: Ctx, itemId: string) {
  const item = await ctx.prisma.shoppingItem.findFirst({
    where: { id: itemId, list: visibleLists(ctx) },
    select: { id: true, listId: true },
  });
  if (!item) throw new TRPCError({ code: "NOT_FOUND" });
  return item;
}

const openItems = { clearedAt: null };

export const shoppingRouter = createTRPCRouter({
  /** Lists you can see, with their open-item counts. A new household gets a Shared "Groceries" list. */
  lists: householdProcedure.query(async ({ ctx }) => {
    const anyList = await ctx.prisma.shoppingList.findFirst({
      where: { householdId: ctx.householdId },
      select: { id: true },
    });
    if (!anyList) {
      await ctx.prisma.shoppingList.create({
        data: { householdId: ctx.householdId, ownerId: null, name: "Groceries" },
      });
    }

    const lists = await ctx.prisma.shoppingList.findMany({
      where: visibleLists(ctx),
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { items: { where: { ...openItems, checkedAt: null } } } },
      },
    });
    return lists.map(({ _count, ...list }) => ({ ...list, openCount: _count.items }));
  }),

  createList: householdProcedure
    .input(z.object({ name: z.string().trim().min(1).max(60), shared: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.shoppingList.create({
        data: {
          householdId: ctx.householdId,
          ownerId: input.shared ? null : ctx.userId,
          name: input.name,
        },
      }),
    ),

  renameList: householdProcedure
    .input(z.object({ id: z.string(), name: z.string().trim().min(1).max(60) }))
    .mutation(async ({ ctx, input }) => {
      await requireList(ctx, input.id);
      return ctx.prisma.shoppingList.update({ where: { id: input.id }, data: { name: input.name } });
    }),

  deleteList: householdProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireList(ctx, input.id);
      await ctx.prisma.shoppingList.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /** Open items first (oldest first), then ticked ones ("In basket"). Cleared items are hidden. */
  items: householdProcedure
    .input(z.object({ listId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireList(ctx, input.listId);
      return ctx.prisma.shoppingItem.findMany({
        where: { listId: input.listId, ...openItems },
        orderBy: { createdAt: "asc" },
        include: { addedBy: { select: { id: true, name: true, email: true } } },
      });
    }),

  addItem: householdProcedure
    .input(
      z.object({
        listId: z.string(),
        name: z.string().trim().min(1).max(120),
        quantity: z.string().trim().max(30).nullable().optional(),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireList(ctx, input.listId);
      return ctx.prisma.shoppingItem.create({
        data: {
          listId: input.listId,
          name: input.name,
          quantity: input.quantity || null,
          note: input.note || null,
          addedById: ctx.userId,
        },
      });
    }),

  updateItem: householdProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1).max(120).optional(),
        quantity: z.string().trim().max(30).nullable().optional(),
        note: z.string().trim().max(200).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireItem(ctx, input.id);
      const { id, ...data } = input;
      return ctx.prisma.shoppingItem.update({
        where: { id },
        data: {
          ...data,
          ...(data.note !== undefined ? { note: data.note || null } : {}),
          ...(data.quantity !== undefined ? { quantity: data.quantity || null } : {}),
        },
      });
    }),

  /** Tick or untick: ticked items move to "In basket". */
  setChecked: householdProcedure
    .input(z.object({ id: z.string(), checked: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireItem(ctx, input.id);
      return ctx.prisma.shoppingItem.update({
        where: { id: input.id },
        data: { checkedAt: input.checked ? new Date() : null },
      });
    }),

  deleteItem: householdProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireItem(ctx, input.id);
      await ctx.prisma.shoppingItem.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /** Removes everything in "In basket" from view, but keeps it as history for suggestions. */
  clearChecked: householdProcedure
    .input(z.object({ listId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireList(ctx, input.listId);
      const result = await ctx.prisma.shoppingItem.updateMany({
        where: { listId: input.listId, ...openItems, checkedAt: { not: null } },
        data: { clearedAt: new Date() },
      });
      return { cleared: result.count };
    }),

  /** Past items matching what you're typing, most-used first (with the amount you last used), skipping ones already open on this list. */
  suggest: householdProcedure
    .input(z.object({ listId: z.string(), q: z.string().trim().min(1).max(60) }))
    .query(async ({ ctx, input }) => {
      await requireList(ctx, input.listId);
      const [past, open] = await Promise.all([
        ctx.prisma.shoppingItem.findMany({
          where: { list: visibleLists(ctx), name: { startsWith: input.q, mode: "insensitive" } },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: { name: true, quantity: true },
        }),
        ctx.prisma.shoppingItem.findMany({
          where: { listId: input.listId, ...openItems, checkedAt: null },
          select: { name: true },
        }),
      ]);
      const openNames = new Set(open.map((i) => i.name.toLowerCase()));
      const byName = new Map<string, { name: string; quantity: string | null; count: number }>();
      for (const item of past) {
        const key = item.name.toLowerCase();
        if (openNames.has(key)) continue;
        // `past` is newest first, so the first sighting carries the most recent amount.
        const entry = byName.get(key);
        if (entry) entry.count += 1;
        else byName.set(key, { name: item.name, quantity: item.quantity, count: 1 });
      }
      return [...byName.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
        .map(({ name, quantity }) => ({ name, quantity }));
    }),

  /** Favorites of one list: the things you regularly need, one tap from being added. */
  favorites: householdProcedure
    .input(z.object({ listId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireList(ctx, input.listId);
      return ctx.prisma.shoppingFavorite.findMany({
        where: { listId: input.listId },
        orderBy: { createdAt: "asc" },
      });
    }),

  addFavorite: householdProcedure
    .input(
      z.object({
        listId: z.string(),
        name: z.string().trim().min(1).max(120),
        quantity: z.string().trim().max(30).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireList(ctx, input.listId);
      const existing = await ctx.prisma.shoppingFavorite.findFirst({
        where: { listId: input.listId, name: { equals: input.name, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) return existing;
      return ctx.prisma.shoppingFavorite.create({
        data: { listId: input.listId, name: input.name, quantity: input.quantity || null },
        select: { id: true },
      });
    }),

  removeFavorite: householdProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const favorite = await ctx.prisma.shoppingFavorite.findFirst({
        where: { id: input.id, list: visibleLists(ctx) },
        select: { id: true },
      });
      if (!favorite) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.shoppingFavorite.delete({ where: { id: input.id } });
      return { success: true };
    }),
});

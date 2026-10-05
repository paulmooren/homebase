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

  /**
   * Open items (oldest first), plus anything ticked in the last minute so a
   * mis-tap can be undone. Older ticked items stay in the database as history
   * for suggestions but are no longer sent.
   */
  items: householdProcedure
    .input(z.object({ listId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireList(ctx, input.listId);
      return ctx.prisma.shoppingItem.findMany({
        where: {
          listId: input.listId,
          ...openItems,
          OR: [{ checkedAt: null }, { checkedAt: { gte: new Date(Date.now() - 60_000) } }],
        },
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

  /** Tick or untick. A ticked item disappears from the list a few seconds later (see the client's tick grace). */
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

  /** Past item names matching what you're typing, most-used first, skipping ones already open on this list. */
  suggest: householdProcedure
    .input(z.object({ listId: z.string(), q: z.string().trim().min(1).max(60) }))
    .query(async ({ ctx, input }) => {
      await requireList(ctx, input.listId);
      const [past, open] = await Promise.all([
        ctx.prisma.shoppingItem.findMany({
          where: { list: visibleLists(ctx), name: { startsWith: input.q, mode: "insensitive" } },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: { name: true },
        }),
        ctx.prisma.shoppingItem.findMany({
          where: { listId: input.listId, ...openItems, checkedAt: null },
          select: { name: true },
        }),
      ]);
      const openNames = new Set(open.map((i) => i.name.toLowerCase()));
      const counts = new Map<string, { name: string; count: number }>();
      for (const item of past) {
        const key = item.name.toLowerCase();
        if (openNames.has(key)) continue;
        const entry = counts.get(key);
        if (entry) entry.count += 1;
        else counts.set(key, { name: item.name, count: 1 });
      }
      return [...counts.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
        .map((entry) => entry.name);
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
        data: { listId: input.listId, name: input.name },
        select: { id: true },
      });
    }),

  /** Rename a favorite. */
  updateFavorite: householdProcedure
    .input(z.object({ id: z.string(), name: z.string().trim().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const favorite = await ctx.prisma.shoppingFavorite.findFirst({
        where: { id: input.id, list: visibleLists(ctx) },
        select: { id: true },
      });
      if (!favorite) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.shoppingFavorite.update({
        where: { id: input.id },
        data: { name: input.name },
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

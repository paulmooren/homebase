import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

import { createTRPCRouter, householdProcedure } from "@/server/api/trpc";

type Ctx = { prisma: PrismaClient; householdId: string; userId: string };

/** Accepts "example.com/x" as well as full links, and only ever http(s) — never javascript: and friends. */
const urlSchema = z
  .string()
  .trim()
  .max(500)
  .transform((value) => (/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`))
  .refine((value) => /^https?:\/\/[^\s]+$/i.test(value), "Enter a web link");

const wishFields = {
  title: z.string().trim().min(1).max(120),
  url: urlSchema.nullable().optional(),
  price: z.number().nonnegative().max(1_000_000).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
};

/**
 * Whose wishlist you may look at: the Home list, your own, or a housemate's
 * that they have left visible. Hidden lists behave as if they don't exist.
 */
async function requireViewableList(ctx: Ctx, ownerId: string | null) {
  if (ownerId === null || ownerId === ctx.userId) return;
  const member = await ctx.prisma.householdMember.findFirst({
    where: { householdId: ctx.householdId, userId: ownerId, wishlistVisible: true },
    select: { id: true },
  });
  if (!member) throw new TRPCError({ code: "NOT_FOUND" });
}

/** Wishes you can edit: your own, or any on the Home list. */
async function requireEditableWish(ctx: Ctx, id: string) {
  const wish = await ctx.prisma.wish.findFirst({
    where: { id, householdId: ctx.householdId, OR: [{ ownerId: null }, { ownerId: ctx.userId }] },
    select: { id: true },
  });
  if (!wish) throw new TRPCError({ code: "NOT_FOUND" });
}

export const wishlistRouter = createTRPCRouter({
  /**
   * One wishlist: a member's (`ownerId` = their user id) or the Home list
   * (`ownerId` = null). Claims are stripped from your own wishes — the owner
   * never sees who is buying what — but shown on everyone else's and on Home.
   */
  list: householdProcedure
    .input(z.object({ ownerId: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      await requireViewableList(ctx, input.ownerId);
      const wishes = await ctx.prisma.wish.findMany({
        where: { householdId: ctx.householdId, ownerId: input.ownerId },
        orderBy: { createdAt: "desc" },
        include: { claimedBy: { select: { id: true, name: true, email: true } } },
      });
      const mine = input.ownerId === ctx.userId;
      return wishes.map(({ price, claimedBy, claimedById, ...wish }) => ({
        ...wish,
        price: price === null ? null : Number(price),
        claimedBy: mine ? null : claimedBy,
        claimedByMe: mine ? false : claimedById === ctx.userId,
      }));
    }),

  add: householdProcedure
    .input(z.object({ home: z.boolean(), ...wishFields }))
    .mutation(({ ctx, input }) => {
      const { home, ...data } = input;
      return ctx.prisma.wish.create({
        data: {
          householdId: ctx.householdId,
          ownerId: home ? null : ctx.userId,
          ...data,
          url: data.url || null,
          note: data.note || null,
          price: data.price ?? null,
        },
      });
    }),

  update: householdProcedure
    .input(z.object({ id: z.string(), ...wishFields }))
    .mutation(async ({ ctx, input }) => {
      await requireEditableWish(ctx, input.id);
      const { id, ...data } = input;
      return ctx.prisma.wish.update({
        where: { id },
        data: { ...data, url: data.url || null, note: data.note || null, price: data.price ?? null },
      });
    }),

  delete: householdProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireEditableWish(ctx, input.id);
      await ctx.prisma.wish.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /** The owner (or anyone, on Home) marks a wish as received; it moves to the archive. */
  setReceived: householdProcedure
    .input(z.object({ id: z.string(), received: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireEditableWish(ctx, input.id);
      return ctx.prisma.wish.update({
        where: { id: input.id },
        data: { receivedAt: input.received ? new Date() : null },
      });
    }),

  /** Claim a housemate's (or a Home) wish. One Claim per wish — first come, first served. */
  claim: householdProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const wish = await ctx.prisma.wish.findFirst({
        where: { id: input.id, householdId: ctx.householdId },
        select: { ownerId: true },
      });
      if (!wish || wish.ownerId === ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });
      await requireViewableList(ctx, wish.ownerId);

      // Atomic: only succeeds if nobody has claimed it yet.
      const result = await ctx.prisma.wish.updateMany({
        where: { id: input.id, claimedById: null, receivedAt: null },
        data: { claimedById: ctx.userId },
      });
      if (result.count === 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Someone already claimed this." });
      }
      return { success: true };
    }),

  /** You can only release a Claim you made yourself. */
  unclaim: householdProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.wish.updateMany({
        where: { id: input.id, householdId: ctx.householdId, claimedById: ctx.userId },
        data: { claimedById: null },
      });
      return { success: true };
    }),

  /** Show or hide your whole wishlist from the rest of the household. */
  setVisibility: householdProcedure
    .input(z.object({ visible: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.householdMember.update({
        where: { userId: ctx.userId },
        data: { wishlistVisible: input.visible },
        select: { wishlistVisible: true },
      }),
    ),
});

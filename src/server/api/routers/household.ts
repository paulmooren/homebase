import { randomInt } from "crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { DEFAULT_CATEGORIES } from "@/lib/constants";
import { createTRPCRouter, householdProcedure, protectedProcedure } from "@/server/api/trpc";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

function generateInviteCode(length = 10) {
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export const householdRouter = createTRPCRouter({
  current: protectedProcedure.query(async ({ ctx }) => {
    const membership = await ctx.prisma.householdMember.findUnique({
      where: { userId: ctx.userId },
      select: { householdId: true },
    });
    if (!membership) return null;

    const household = await ctx.prisma.household.findUniqueOrThrow({
      where: { id: membership.householdId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });
    const activeInvite = await ctx.prisma.householdInvite.findFirst({
      where: { householdId: household.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { code: true },
    });

    return {
      id: household.id,
      name: household.name,
      members: household.members,
      inviteCode: activeInvite?.code ?? null,
    };
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(60) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.householdMember.findUnique({
        where: { userId: ctx.userId },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "You already belong to a household." });
      }

      return ctx.prisma.$transaction(async (tx) => {
        const household = await tx.household.create({
          data: { name: input.name, members: { create: { userId: ctx.userId } } },
        });
        await tx.category.createMany({
          data: DEFAULT_CATEGORIES.map((c) => ({
            householdId: household.id,
            name: c.name,
            color: c.color,
          })),
        });
        await tx.householdInvite.create({
          data: { householdId: household.id, code: generateInviteCode(), createdByUserId: ctx.userId },
        });
        return household;
      });
    }),

  join: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.householdMember.findUnique({
        where: { userId: ctx.userId },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "You already belong to a household." });
      }

      const invite = await ctx.prisma.householdInvite.findFirst({
        where: { code: input.code.trim().toUpperCase(), revokedAt: null },
      });
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or revoked invite code." });
      }

      await ctx.prisma.householdMember.create({
        data: { householdId: invite.householdId, userId: ctx.userId },
      });
      return { householdId: invite.householdId };
    }),

  rename: householdProcedure
    .input(z.object({ name: z.string().min(1).max(60) }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.household.update({ where: { id: ctx.householdId }, data: { name: input.name } }),
    ),

  regenerateInvite: householdProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.householdInvite.updateMany({
      where: { householdId: ctx.householdId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const invite = await ctx.prisma.householdInvite.create({
      data: { householdId: ctx.householdId, code: generateInviteCode(), createdByUserId: ctx.userId },
    });
    return { code: invite.code };
  }),
});

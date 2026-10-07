import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, householdProcedure } from "@/server/api/trpc";

const nameSchema = z.string().trim().min(1).max(60);

/**
 * Budget groups — Rent, Insurances, Savings — are one list for the whole
 * household, so any member may create, rename or delete one. Deleting a group
 * never deletes its items: they go back to "Other".
 */
export const budgetGroupRouter = createTRPCRouter({
  list: householdProcedure.query(({ ctx }) =>
    ctx.prisma.budgetGroup.findMany({
      where: { householdId: ctx.householdId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
  ),

  create: householdProcedure.input(z.object({ name: nameSchema })).mutation(async ({ ctx, input }) => {
    const last = await ctx.prisma.budgetGroup.aggregate({ where: { householdId: ctx.householdId }, _max: { sortOrder: true } });
    try {
      return await ctx.prisma.budgetGroup.create({
        data: { householdId: ctx.householdId, name: input.name, sortOrder: (last._max.sortOrder ?? 0) + 1 },
        select: { id: true, name: true },
      });
    } catch {
      throw new TRPCError({ code: "CONFLICT", message: "A group with this name already exists." });
    }
  }),

  rename: householdProcedure
    .input(z.object({ id: z.string(), name: nameSchema }))
    .mutation(async ({ ctx, input }) => {
      const found = await ctx.prisma.budgetGroup.findFirst({ where: { id: input.id, householdId: ctx.householdId }, select: { id: true } });
      if (!found) throw new TRPCError({ code: "NOT_FOUND" });
      try {
        return await ctx.prisma.budgetGroup.update({ where: { id: input.id }, data: { name: input.name }, select: { id: true, name: true } });
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "A group with this name already exists." });
      }
    }),

  delete: householdProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const found = await ctx.prisma.budgetGroup.findFirst({ where: { id: input.id, householdId: ctx.householdId }, select: { id: true } });
    if (!found) throw new TRPCError({ code: "NOT_FOUND" });
    await ctx.prisma.budgetGroup.delete({ where: { id: input.id } });
    return { success: true };
  }),
});

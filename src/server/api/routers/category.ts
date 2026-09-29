import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, householdProcedure } from "@/server/api/trpc";

export const categoryRouter = createTRPCRouter({
  list: householdProcedure.query(({ ctx }) => {
    return ctx.prisma.category.findMany({
      where: { householdId: ctx.householdId },
      orderBy: { name: "asc" },
    });
  }),

  create: householdProcedure
    .input(z.object({ name: z.string().min(1).max(40), color: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.prisma.category.create({
          data: { householdId: ctx.householdId, name: input.name, color: input.color },
        });
      } catch {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This category already exists.",
        });
      }
    }),

  update: householdProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(40).optional(),
        color: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.prisma.category.findFirst({
        where: { id, householdId: ctx.householdId },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.category.update({ where: { id }, data });
    }),

  delete: householdProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.category.findFirst({
        where: { id: input.id, householdId: ctx.householdId },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.category.delete({ where: { id: input.id } });
      return { success: true };
    }),
});

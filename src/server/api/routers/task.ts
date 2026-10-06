import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, householdProcedure } from "@/server/api/trpc";

const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const taskRouter = createTRPCRouter({
  list: householdProcedure.query(({ ctx }) => {
    return ctx.prisma.task.findMany({
      where: { householdId: ctx.householdId, frequency: null },
      include: { owner: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  }),

  create: householdProcedure
    .input(
      z.object({
        title: z.string().min(1).max(160),
        priority: prioritySchema.optional(),
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

      return ctx.prisma.task.create({
        data: {
          householdId: ctx.householdId,
          ownerId: input.ownerId ?? null,
          title: input.title,
          priority: input.priority ?? "MEDIUM",
        },
      });
    }),

  update: householdProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(160).optional(),
        priority: prioritySchema.optional(),
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

      const existing = await ctx.prisma.task.findFirst({
        where: { id, householdId: ctx.householdId },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.task.update({
        where: { id },
        data: { ...data, ...(ownerId !== undefined ? { ownerId } : {}) },
      });
    }),

  toggleComplete: householdProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.task.findFirst({
        where: { id: input.id, householdId: ctx.householdId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.task.update({
        where: { id: input.id },
        data: { completedAt: existing.completedAt ? null : new Date() },
      });
    }),

  delete: householdProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.task.findFirst({
        where: { id: input.id, householdId: ctx.householdId },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.task.delete({ where: { id: input.id } });
      return { success: true };
    }),
});

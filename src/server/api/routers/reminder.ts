import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

import { createTRPCRouter, householdProcedure } from "@/server/api/trpc";
import { nextDueDate, todayInHousehold } from "@/lib/schedule";

type Ctx = { prisma: PrismaClient; householdId: string; userId: string };

const unitSchema = z.enum(["DAY", "WEEK", "MONTH", "YEAR"]);
const modeSchema = z.enum(["FROM_DONE", "FIXED"]);

const scheduleFields = {
  title: z.string().trim().min(1).max(160),
  intervalCount: z.number().int().min(1).max(999),
  intervalUnit: unitSchema,
  mode: modeSchema,
  ownerId: z.string().nullable(),
};

async function requireMember(ctx: Ctx, userId: string | null | undefined) {
  if (!userId) return;
  const member = await ctx.prisma.householdMember.findFirst({
    where: { householdId: ctx.householdId, userId },
    select: { id: true },
  });
  if (!member) throw new TRPCError({ code: "BAD_REQUEST", message: "Not a household member." });
}

async function requireReminder(ctx: Ctx, id: string) {
  const reminder = await ctx.prisma.reminder.findFirst({ where: { id, householdId: ctx.householdId } });
  if (!reminder) throw new TRPCError({ code: "NOT_FOUND" });
  return reminder;
}

export const reminderRouter = createTRPCRouter({
  /** Every Reminder in the household (they are never private), with its last few completions. */
  list: householdProcedure.query(({ ctx }) =>
    ctx.prisma.reminder.findMany({
      where: { householdId: ctx.householdId },
      orderBy: [{ nextDueDate: "asc" }, { title: "asc" }],
      include: {
        completions: {
          orderBy: { completedAt: "desc" },
          take: 5,
          include: { completedBy: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
  ),

  create: householdProcedure
    .input(z.object({ ...scheduleFields, firstDueDate: z.coerce.date().optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireMember(ctx, input.ownerId);
      const { firstDueDate, ...data } = input;
      return ctx.prisma.reminder.create({
        data: { ...data, householdId: ctx.householdId, nextDueDate: firstDueDate ?? todayInHousehold() },
      });
    }),

  update: householdProcedure
    .input(
      z.object({
        id: z.string(),
        title: scheduleFields.title.optional(),
        intervalCount: scheduleFields.intervalCount.optional(),
        intervalUnit: unitSchema.optional(),
        mode: modeSchema.optional(),
        ownerId: z.string().nullable().optional(),
        nextDueDate: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireReminder(ctx, input.id);
      await requireMember(ctx, input.ownerId);
      const { id, ...data } = input;
      return ctx.prisma.reminder.update({ where: { id }, data });
    }),

  /** Ticks a Reminder off: records who and when, and works out the next due date. */
  complete: householdProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const reminder = await requireReminder(ctx, input.id);
    const today = todayInHousehold();
    const next = nextDueDate({
      mode: reminder.mode,
      dueDate: reminder.nextDueDate,
      today,
      count: reminder.intervalCount,
      unit: reminder.intervalUnit,
    });
    const [completion, updated] = await ctx.prisma.$transaction([
      ctx.prisma.reminderCompletion.create({
        data: { reminderId: reminder.id, completedById: ctx.userId, dueDateAtCompletion: reminder.nextDueDate },
        select: { id: true },
      }),
      ctx.prisma.reminder.update({ where: { id: reminder.id }, data: { nextDueDate: next } }),
    ]);
    return { completionId: completion.id, nextDueDate: updated.nextDueDate };
  }),

  /** Takes back a mis-tapped completion: removes it and restores the old due date. */
  undoComplete: householdProcedure.input(z.object({ completionId: z.string() })).mutation(async ({ ctx, input }) => {
    const completion = await ctx.prisma.reminderCompletion.findFirst({
      where: { id: input.completionId, reminder: { householdId: ctx.householdId } },
    });
    if (!completion) throw new TRPCError({ code: "NOT_FOUND" });
    await ctx.prisma.$transaction([
      ctx.prisma.reminderCompletion.delete({ where: { id: completion.id } }),
      ...(completion.dueDateAtCompletion
        ? [
            ctx.prisma.reminder.update({
              where: { id: completion.reminderId },
              data: { nextDueDate: completion.dueDateAtCompletion },
            }),
          ]
        : []),
    ]);
    return { success: true };
  }),

  delete: householdProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await requireReminder(ctx, input.id);
    await ctx.prisma.reminder.delete({ where: { id: input.id } });
    return { success: true };
  }),
});

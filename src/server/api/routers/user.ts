import { z } from "zod";

import { createTRPCRouter, householdProcedure, protectedProcedure } from "@/server/api/trpc";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(({ ctx }) => {
    return ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { id: true, email: true, name: true, image: true },
    });
  }),

  updateName: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(60) }))
    .mutation(({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { name: input.name },
      });
    }),

  // Stored as a small data URL (the client crops/downsizes it first), so no
  // file storage is needed. null removes the picture.
  updateAvatar: protectedProcedure
    .input(
      z.object({
        image: z
          .string()
          .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
          .max(200_000)
          .nullable(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { image: input.image },
        select: { id: true },
      });
    }),

  exportData: householdProcedure.query(async ({ ctx }) => {
    // Same visibility filter as account.list/transaction.list — export must
    // not become a backdoor around a partner's personal-account privacy,
    // even though the in-app views now show visible-but-personal rows too.
    const ownerOrShared = { OR: [{ ownerId: null }, { ownerId: ctx.userId }] };
    const [accounts, categories, budgets] = await Promise.all([
      ctx.prisma.financialAccount.findMany({
        where: { householdId: ctx.householdId, ...ownerOrShared },
      }),
      ctx.prisma.category.findMany({ where: { householdId: ctx.householdId } }),
      ctx.prisma.budget.findMany({ where: { householdId: ctx.householdId, ...ownerOrShared } }),
    ]);
    const transactions = await ctx.prisma.transaction.findMany({
      where: { householdId: ctx.householdId, accountId: { in: accounts.map((a) => a.id) } },
    });
    return { exportedAt: new Date().toISOString(), accounts, categories, transactions, budgets };
  }),
});

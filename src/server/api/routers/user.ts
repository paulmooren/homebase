import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { isDemoServer } from "@/lib/demo";

import { hashPassword, verifyPassword } from "@/lib/password";
import { createTRPCRouter, householdProcedure, protectedProcedure } from "@/server/api/trpc";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const { password, ...user } = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { id: true, email: true, name: true, image: true, password: true },
    });
    // Never send the hash itself — the UI only needs to know whether one exists.
    return { ...user, hasPassword: password !== null };
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

  // Accounts that signed up with Google have no password yet, so they may set
  // one without a current password; otherwise the current one must match.
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().optional(),
        newPassword: z.string().min(8).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (isDemoServer()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Passwords can't be changed in the demo." });
      }
      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { password: true },
      });
      if (user.password) {
        const ok = input.currentPassword
          ? await verifyPassword(input.currentPassword, user.password)
          : false;
        if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is incorrect." });
      }
      await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { password: await hashPassword(input.newPassword) },
      });
      return { success: true };
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

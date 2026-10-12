import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { isDemoServer } from "@/lib/demo";

import { hashPassword, verifyPassword } from "@/lib/password";
import { createTRPCRouter, householdProcedure, protectedProcedure } from "@/server/api/trpc";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { id: true, email: true, name: true, image: true },
    });
    // Never send the hash itself — the UI only needs to know whether one exists.
    const credential = await ctx.prisma.authAccount.findFirst({
      where: { userId: ctx.userId, providerId: "credential", password: { not: null } },
      select: { id: true },
    });
    return { ...user, hasPassword: credential !== null };
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
      // The password lives on the user's "credential" sign-in account (see src/lib/auth.ts).
      const credential = await ctx.prisma.authAccount.findFirst({
        where: { userId: ctx.userId, providerId: "credential" },
        select: { id: true, password: true },
      });
      if (credential?.password) {
        const ok = input.currentPassword
          ? await verifyPassword(input.currentPassword, credential.password)
          : false;
        if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is incorrect." });
      }
      const hash = await hashPassword(input.newPassword);
      if (credential) {
        await ctx.prisma.authAccount.update({ where: { id: credential.id }, data: { password: hash } });
      } else {
        await ctx.prisma.authAccount.create({
          data: { id: randomUUID(), accountId: ctx.userId, providerId: "credential", userId: ctx.userId, password: hash },
        });
      }
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

import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { pushConfigured, sendToUser } from "@/server/push";

export const notificationRouter = createTRPCRouter({
  /** Whether the server can send pushes at all, and how many of your devices have them on. */
  status: protectedProcedure.query(async ({ ctx }) => ({
    configured: pushConfigured(),
    devices: await ctx.prisma.pushSubscription.count({ where: { userId: ctx.userId } }),
  })),

  /** Registers this phone/browser. The same device switching on again just refreshes it. */
  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url().max(2000),
        p256dh: z.string().max(300),
        auth: z.string().max(100),
        userAgent: z.string().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: { ...input, userId: ctx.userId },
        update: { userId: ctx.userId, p256dh: input.p256dh, auth: input.auth, userAgent: input.userAgent },
      });
      return { success: true };
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.pushSubscription.deleteMany({ where: { endpoint: input.endpoint, userId: ctx.userId } });
      return { success: true };
    }),

  /** Sends one notification to all of your devices, so you can check it works. */
  sendTest: protectedProcedure.mutation(async ({ ctx }) => {
    const sent = await sendToUser(ctx.prisma, ctx.userId, {
      title: "Homebase",
      body: "Notifications are working — you'll hear about reminders here.",
      url: "/settings/notifications",
    });
    return { sent };
  }),
});

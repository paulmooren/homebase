import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { isDemoEmail, isDemoServer } from "@/lib/demo";
import { seedDemo } from "@/server/demo/seed";

export const demoRouter = createTRPCRouter({
  /** Puts the Demo back to its clean starting state. Only exists in the Demo, and only for its two people. */
  reset: protectedProcedure.mutation(async ({ ctx }) => {
    const email = ctx.session.user.email ?? "";
    if (!isDemoServer() || !isDemoEmail(email)) throw new TRPCError({ code: "FORBIDDEN" });
    await seedDemo(ctx.prisma);
    return { success: true };
  }),
});

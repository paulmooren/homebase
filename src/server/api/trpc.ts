import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHouseholdIdForUser } from "@/server/api/household";

export async function createTRPCContext() {
  const session = await auth();
  return { session, prisma };
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

/** Requires a signed-in user; narrows `ctx.session` to non-null and adds `ctx.userId`. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userId: ctx.session.user.id,
    },
  });
});

/** Requires the signed-in user to belong to a household; adds `ctx.householdId`. */
export const householdProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const householdId = await getHouseholdIdForUser(ctx.prisma, ctx.userId);
  if (!householdId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "NO_HOUSEHOLD" });
  }
  return next({ ctx: { ...ctx, householdId } });
});

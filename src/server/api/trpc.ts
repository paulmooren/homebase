import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHouseholdIdForUser } from "@/server/api/household";

type HouseholdIdLookup = (userId: string) => Promise<string | null>;

/**
 * One context per request. `getHouseholdId` looks the signed-in user's Household up in the database at most once
 * per request, however many procedures run in it (a batched call can carry ten), and always reads the database —
 * never the sign-in cookie — so someone removed from a Household is refused on their very next request.
 * Server components pass their own `lookupHouseholdId` so the layout, the page and the prefetches share one lookup.
 */
export async function createTRPCContext(opts?: { lookupHouseholdId?: HouseholdIdLookup }) {
  const session = await auth();
  const lookup = opts?.lookupHouseholdId ?? ((userId: string) => getHouseholdIdForUser(prisma, userId));
  const userId = session?.user?.id;
  let pending: Promise<string | null> | undefined;
  const getHouseholdId = () => {
    if (!userId) return Promise.resolve(null);
    return (pending ??= lookup(userId));
  };
  return { session, prisma, getHouseholdId };
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
export const createCallerFactory = t.createCallerFactory;
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
  const householdId = await ctx.getHouseholdId();
  if (!householdId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "NO_HOUSEHOLD" });
  }
  return next({ ctx: { ...ctx, householdId } });
});

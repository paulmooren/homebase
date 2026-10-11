import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

/**
 * The id a client gives to a row it creates (see `newId` in `@/lib/client-id`), so it can show and change the
 * row before the server has answered. Optional: without it the database makes one.
 */
export const clientIdSchema = z.uuid().optional();

/** Runs a create; an id that is already taken is a CONFLICT instead of a database error. */
export async function rejectDuplicateId<T>(create: () => Promise<T>): Promise<T> {
  try {
    return await create();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = error.meta?.target;
      const onId = Array.isArray(target) ? target.includes("id") : typeof target === "string" && /(^|_)(pkey|id)(_|$)/.test(target);
      if (onId) throw new TRPCError({ code: "CONFLICT", message: "This id is already in use." });
    }
    throw error;
  }
}

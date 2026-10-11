import { cache } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import { prisma } from "@/lib/prisma";
import { appRouter } from "@/server/api/root";
import { getHouseholdIdForUser } from "@/server/api/household";
import { createCallerFactory, createTRPCContext } from "@/server/api/trpc";
import { makeQueryClient } from "@/trpc/query-client";

/** One QueryClient per incoming request, shared by the layout and the page, so each query is loaded once. */
export const getQueryClient = cache(makeQueryClient);

/** The Household lookup, once per request however many server components ask. */
const householdIdForUser = cache((userId: string) => getHouseholdIdForUser(prisma, userId));

/** One context per request for everything that renders on the server. */
export const getServerContext = cache(() => createTRPCContext({ lookupHouseholdId: householdIdForUser }));

/** Calls procedures directly (no HTTP), as the signed-in user, through the same checks as the API. */
export const caller = createCallerFactory(appRouter)(() => getServerContext());

/**
 * Loads one query on the server and files it where the client's `useQuery` for the same query will look, so the
 * page arrives with the data instead of fetching it after it has loaded. `path` and `input` must be exactly what
 * the client passes (`"shopping.items"`, `{ listId }`). A query already loaded in this request is reused, and one
 * that fails is left for the client to try again — the page never breaks because a prefetch did. Returns the data
 * so a page can decide what to load next.
 */
export async function loadQuery<T>(path: string, input: unknown, run: () => Promise<T>): Promise<T | undefined> {
  const queryKey = [path.split("."), input === undefined ? { type: "query" } : { input, type: "query" }];
  try {
    return await getQueryClient().fetchQuery({ queryKey, queryFn: run, staleTime: Infinity });
  } catch {
    return undefined;
  }
}

/** The signed-in user's Household with its members, for Module on/off decisions as well as for the client. */
export const loadHousehold = () => loadQuery("household.current", undefined, () => caller.household.current());

/** Hands everything loaded so far to the client components below it. */
export function HydrateClient({ children }: { children: React.ReactNode }) {
  return <HydrationBoundary state={dehydrate(getQueryClient())}>{children}</HydrationBoundary>;
}

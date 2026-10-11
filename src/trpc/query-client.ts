import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";

/**
 * Prefetched data crosses from server to browser the way an API response does: superjson, then plain JSON. The JSON
 * step matters — the browser's React refuses class instances such as Prisma's Decimal, which JSON turns into the
 * strings the screens already expect from the API.
 */
const serializeData = (data: unknown) => JSON.parse(JSON.stringify(superjson.serialize(data)));

/** How long loaded data counts as fresh. */
const STALE_TIME_MS = 30_000;

/**
 * The one place a QueryClient is made, for the browser and for the server's prefetching alike.
 * Data just loaded counts as fresh for 30 s: going back to a page shows it at once and updates it quietly
 * (and the window regaining focus refetches). A change the Member makes refreshes the lists it touches anyway.
 */
export function makeQueryClient(options: { refetchOnWindowFocus?: () => boolean } = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: STALE_TIME_MS, ...options },
      dehydrate: { serializeData },
      hydrate: { deserializeData: superjson.deserialize },
    },
  });
}

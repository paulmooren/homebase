import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";

/**
 * Prefetched data crosses from server to browser the way an API response does: superjson, then plain JSON. The JSON
 * step matters — the browser's React refuses class instances such as Prisma's Decimal, which JSON turns into the
 * strings the screens already expect from the API.
 */
const serializeData = (data: unknown) => JSON.parse(JSON.stringify(superjson.serialize(data)));

/** The one place a QueryClient is made, for the browser and for the server's prefetching alike. */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      dehydrate: { serializeData },
      hydrate: { deserializeData: superjson.deserialize },
    },
  });
}

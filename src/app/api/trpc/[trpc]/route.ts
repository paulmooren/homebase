import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

async function handler(req: Request) {
  const res = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });
  // Every response here is per-user, cookie-authenticated data — GET queries
  // (tRPC's default for reads) are otherwise cacheable by the browser's HTTP
  // cache with no Cache-Control header at all, which can serve one user's
  // response back to a different session in the same browser.
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export { handler as GET, handler as POST };

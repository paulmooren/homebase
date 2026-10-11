"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import { hasAnyPendingChanges } from "@/trpc/pending";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { ToastProvider } from "@/components/toast";
import type { AppRouter } from "@/server/api/root";

/** How long loaded data counts as fresh. */
const STALE_TIME_MS = 30_000;

export const trpc = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  // Data just loaded counts as fresh for 30 s: going back to a page shows it at once and updates it quietly
  // (and the window regaining focus refetches). A change the Member makes refreshes the lists it touches anyway.
  const [queryClient] = useState(() => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: STALE_TIME_MS,
          // Not while a change is still being saved: a refetch landing now would bring the old data back for a moment.
          refetchOnWindowFocus: () => !hasAnyPendingChanges(),
        },
      },
    }));
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ConfirmProvider>
          <ToastProvider>{children}</ToastProvider>
        </ConfirmProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

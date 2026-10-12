"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import { hasAnyPendingChanges } from "@/trpc/pending";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { ToastProvider } from "@/components/toast";
import { makeQueryClient } from "@/trpc/query-client";
import type { AppRouter } from "@/server/api/root";

export const trpc = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  // Not while a change is still being saved: a refetch landing now would bring the old data back for a moment.
  const [queryClient] = useState(() => makeQueryClient({ refetchOnWindowFocus: () => !hasAnyPendingChanges() }));
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

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { trpc } from "@/trpc/react";
import { isModuleEnabled, type ModuleKey } from "@/lib/modules";

/** Which Modules the current Household has on. `ready` is false until it loads. */
export function useModules() {
  const { data: household } = trpc.household.current.useQuery();
  const disabled = household?.disabledModules ?? [];
  return {
    ready: !!household,
    isEnabled: (key: ModuleKey) => isModuleEnabled(disabled, key),
  };
}

/** Sends you to the dashboard if the Module is switched off, instead of showing its page. */
export function ModuleGate({ module, children }: { module: ModuleKey; children: React.ReactNode }) {
  const router = useRouter();
  const { ready, isEnabled } = useModules();
  const enabled = isEnabled(module);

  useEffect(() => {
    if (ready && !enabled) router.replace("/dashboard");
  }, [ready, enabled, router]);

  if (!ready || !enabled) return null;
  return <>{children}</>;
}

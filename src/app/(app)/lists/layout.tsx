"use client";

import { TabBar } from "@/components/tab-bar";
import { useModules } from "@/components/use-modules";
import type { ModuleKey } from "@/lib/modules";

const TABS: { href: string; label: string; module: ModuleKey }[] = [
  { href: "/lists/shopping", label: "Shopping", module: "shopping" },
];

export default function ListsLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = useModules();
  const tabs = TABS.filter((t) => isEnabled(t.module));

  return (
    <div className="flex flex-col gap-5">
      {tabs.length > 1 && <TabBar tabs={tabs} />}
      {children}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = { href: string; label: string };

/** Underlined page tabs. */
export function TabBar({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border-soft">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-3.5 pb-3 text-[13.5px] font-medium transition-colors ${
              active ? "border-text text-text" : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

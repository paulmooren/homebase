"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = { href: string; label: string; count?: number };

/** Underlined page tabs; an optional count shows as a round badge. */
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
            {tab.count !== undefined && (
              <span
                // Fixed height + min-width equal to it: a single digit is a
                // true circle, two digits stretch into a pill.
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-none tabular-nums ${
                  active ? "bg-text text-bg" : "border border-border bg-surface text-text-muted"
                }`}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

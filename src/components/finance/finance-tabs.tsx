"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { trpc } from "@/trpc/react";

const TABS = [
  { href: "/finance/budgets", label: "Budgets" },
  { href: "/finance/transactions", label: "Transactions" },
  { href: "/finance/accounts", label: "Accounts" },
];

export function FinanceTabs({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: accounts } = trpc.account.list.useQuery();
  const { data: recurring } = trpc.recurring.list.useQuery();

  const counts: Record<string, number | undefined> = {
    "/finance/accounts": accounts?.length,
    "/finance/budgets": recurring?.length,
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-1 border-b border-border-soft">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            const count = counts[tab.href];
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 border-b-2 px-3.5 pb-3 text-[13.5px] font-medium transition-colors ${
                  active
                    ? "border-text text-text"
                    : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                {tab.label}
                {count !== undefined && (
                  <span
                    // Fixed height + min-width equal to it: a single digit is a
                    // true circle, two digits stretch into a pill.
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-none tabular-nums ${
                      active
                        ? "bg-text text-bg"
                        : "border border-border bg-surface text-text-muted"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}

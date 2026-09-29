"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { trpc } from "@/trpc/react";

const TABS = [
  { href: "/finance/transactions", label: "Transactions" },
  { href: "/finance/budgets", label: "Budgets" },
  { href: "/finance/accounts", label: "Accounts" },
];

export function FinanceTabs({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: accounts } = trpc.account.list.useQuery();
  const { data: budgets } = trpc.budget.list.useQuery();
  const { data: recurring } = trpc.recurring.list.useQuery();

  const counts: Record<string, number | undefined> = {
    "/finance/accounts": accounts?.length,
    "/finance/budgets": (budgets?.length ?? 0) + (recurring?.length ?? 0),
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
                    className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                      active ? "bg-text text-bg" : "bg-surface-2 text-text-faint"
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

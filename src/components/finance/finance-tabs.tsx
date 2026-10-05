"use client";

import { TabBar } from "@/components/tab-bar";

export function FinanceTabs({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <TabBar
        tabs={[
          { href: "/finance/budgets", label: "Budgets" },
          { href: "/finance/transactions", label: "Transactions" },
          { href: "/finance/accounts", label: "Accounts" },
        ]}
      />
      {children}
    </div>
  );
}

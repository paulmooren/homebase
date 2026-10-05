"use client";

import { trpc } from "@/trpc/react";
import { TabBar } from "@/components/tab-bar";

export function FinanceTabs({ children }: { children: React.ReactNode }) {
  const { data: accounts } = trpc.account.list.useQuery();
  const { data: recurring } = trpc.recurring.list.useQuery();

  return (
    <div className="flex flex-col gap-5">
      <TabBar
        tabs={[
          { href: "/finance/budgets", label: "Budgets", count: recurring?.length },
          { href: "/finance/transactions", label: "Transactions" },
          { href: "/finance/accounts", label: "Accounts", count: accounts?.length },
        ]}
      />
      {children}
    </div>
  );
}

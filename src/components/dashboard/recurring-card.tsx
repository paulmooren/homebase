"use client";

import Link from "next/link";

import { trpc } from "@/trpc/react";
import { formatEUR } from "@/lib/format";
import { monthlyEquivalent } from "@/lib/recurring";

export function RecurringCard() {
  const { data: items } = trpc.recurring.list.useQuery();
  const { data: suggestions } = trpc.recurring.suggestions.useQuery();

  const income = items?.filter((i) => i.type === "INCOME") ?? [];
  const expenses = items?.filter((i) => i.type === "EXPENSE") ?? [];
  const monthlyIncome = income.reduce((sum, i) => sum + monthlyEquivalent(i.amount, i.frequency), 0);
  const monthlyExpenses = expenses.reduce((sum, i) => sum + monthlyEquivalent(i.amount, i.frequency), 0);

  return (
    <section className="mt-5 rounded-[20px] border border-border-soft bg-surface p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          Budgeting
          {suggestions && suggestions.length > 0 && (
            <span className="rounded-full bg-accent-fill px-2 py-0.5 text-[10.5px] font-semibold text-accent-ink">
              {suggestions.length} new
            </span>
          )}
        </h2>
        <Link href="/recurring" className="text-[12.5px] text-text-muted hover:text-accent">
          View all
        </Link>
      </div>

      {items?.length === 0 ? (
        <p className="text-[13px] text-text-muted">
          No recurring income or expenses tracked yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
              Monthly income
            </p>
            <p className="text-[18px] font-semibold text-good tabular-nums">{formatEUR(monthlyIncome)}</p>
          </div>
          <div>
            <p className="mb-1 text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
              Monthly expenses
            </p>
            <p className="text-[18px] font-semibold tabular-nums">{formatEUR(monthlyExpenses)}</p>
          </div>
        </div>
      )}
    </section>
  );
}

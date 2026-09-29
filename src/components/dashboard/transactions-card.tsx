"use client";

import Link from "next/link";

import { trpc } from "@/trpc/react";
import { formatEUR, formatDate } from "@/lib/format";
import { TRANSFER_COLOR } from "@/lib/constants";

export function TransactionsCard() {
  const { data: transactions } = trpc.transaction.list.useQuery({ limit: 6 });

  return (
    <section className="mt-5 rounded-[20px] border border-border-soft bg-surface p-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">Recent Transactions</h2>
        <Link href="/transactions" className="text-[12.5px] text-text-muted hover:text-accent">
          View all
        </Link>
      </div>

      {transactions?.length === 0 && (
        <p className="py-3 text-[13px] text-text-muted">No transactions yet.</p>
      )}

      {transactions?.map((t) => {
        const isTransfer = t.type === "TRANSFER";
        const isIncome = t.type === "INCOME";
        const dotColor = isTransfer ? TRANSFER_COLOR : t.category?.color ?? "#9a9da5";

        return (
          <div
            key={t.id}
            className="grid grid-cols-[24px_1.4fr_0.9fr_0.7fr_auto] items-center gap-3.5 rounded-xl px-2 py-3 transition-colors hover:bg-surface-hover md:grid-cols-[24px_1.4fr_0.9fr_0.7fr_auto]"
          >
            <span
              className="mx-auto block h-[9px] w-[9px] rounded-full"
              style={{ background: dotColor }}
            />
            <div className="min-w-0 truncate text-[13.5px] font-medium">{t.merchant}</div>
            <div className="hidden text-[12px] text-text-muted sm:block">
              {isTransfer ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-surface-2 px-2.5 py-0.5 text-[11.5px]">
                  ↔ Transfer
                </span>
              ) : (
                t.category?.name ?? "—"
              )}
            </div>
            <div className="hidden text-[12.5px] text-text-muted sm:block">
              {formatDate(t.date)}
            </div>
            <div
              className={`text-right text-[14px] font-semibold tabular-nums ${
                isIncome ? "text-good" : isTransfer ? "text-text-muted" : ""
              }`}
            >
              {isIncome ? "+" : "−"} {formatEUR(Number(t.amount))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

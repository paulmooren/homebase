"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { trpc } from "@/trpc/react";
import { formatEUR, formatDate } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS, TRANSFER_COLOR, type AccountType } from "@/lib/constants";
import { AccountTypeIcon } from "@/components/account-type-icon";
import { BalanceChart, type BalancePoint, type Granularity } from "@/components/balance-chart";
import { CategoryCell } from "@/components/finance/category-cell";

const COL_DATE = "w-[100px] shrink-0";
const COL_CATEGORY = "w-[160px] shrink-0";
const COL_AMOUNT = "w-[110px] shrink-0";
const COL_ACTIONS = "flex w-[24px] shrink-0 items-center justify-end";
const CELL_TEXT = "text-[14px]";

export default function AccountDetailPage() {
  const { id: accountId } = useParams<{ id: string }>();
  const utils = trpc.useUtils();

  const { data: accounts } = trpc.account.list.useQuery();
  const { data: categories } = trpc.category.list.useQuery();
  const { data: transactions } = trpc.transaction.list.useQuery({ limit: 200, accountId });
  const { data: me } = trpc.user.me.useQuery();

  const [range, setRange] = useState<{ from: Date; to: Date; granularity: Granularity } | null>(null);
  const { data: history } = trpc.dashboard.accountHistory.useQuery(
    { accountId, from: range?.from ?? new Date(), to: range?.to ?? new Date(), granularity: range?.granularity ?? "day" },
    { enabled: !!range },
  );

  const data: BalancePoint[] | undefined = useMemo(
    () => history?.map((h) => ({ date: h.date, value: h.balance })),
    [history],
  );

  const updateTransaction = trpc.transaction.update.useMutation({
    onSuccess: () => utils.transaction.list.invalidate(),
  });
  const deleteTransaction = trpc.transaction.delete.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.dashboard.summary.invalidate();
      utils.dashboard.netWorthHistory.invalidate();
      utils.dashboard.accountHistory.invalidate();
      utils.account.list.invalidate();
    },
  });

  const account = accounts?.find((a) => a.id === accountId);
  const canEdit = account ? account.ownerId === null || account.ownerId === me?.id : false;

  if (accounts && !account) {
    return (
      <div className="flex flex-col gap-5">
        <Link href="/finance/accounts" className="text-[12.5px] font-medium text-text-muted hover:text-text">
          ← Accounts
        </Link>
        <p className="text-[13px] text-text-muted">Account not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Link href="/finance/accounts" className="text-[12.5px] font-medium text-text-muted hover:text-text">
        ← Accounts
      </Link>

      {account && (
        <section className="rounded-[20px] border border-border-soft bg-surface p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-border-soft bg-surface-2 text-text-muted">
              <span className="block h-4 w-4">
                <AccountTypeIcon type={account.type} />
              </span>
            </div>
            <div>
              <h1 className="text-[15px] font-semibold">{account.name}</h1>
              <p className="text-[12px] text-text-muted">
                {account.institution || ACCOUNT_TYPE_LABELS[account.type as AccountType]}
              </p>
            </div>
          </div>
        </section>
      )}

      <BalanceChart
        label="Balance"
        data={data}
        currentValue={account ? Number(account.balance) : 0}
        onRangeChange={setRange}
      />

      <section className="overflow-hidden rounded-[20px] border border-border-soft bg-surface">
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="flex items-center gap-3.5 px-6 pt-5 pb-2.5 text-[10.5px] font-semibold tracking-[0.08em] text-text-faint uppercase">
              <span className="block w-[3px] shrink-0" />
              <div className="min-w-0 flex-1" />
              <div className={COL_DATE}>Date</div>
              <div className={COL_CATEGORY}>Category</div>
              <div className={COL_AMOUNT}>Amount</div>
              <div className={COL_ACTIONS} />
            </div>

            {transactions?.length === 0 && (
              <p className="px-6 py-4 text-[13px] text-text-muted">No transactions yet.</p>
            )}

            {transactions?.map((t) => {
              const isOutgoingTransfer = t.type === "TRANSFER" && t.accountId === accountId;
              const isIncomingTransfer = t.type === "TRANSFER" && t.transferToAccountId === accountId;
              const isInflow = t.type === "INCOME" || isIncomingTransfer;
              const barColor = t.type === "TRANSFER" ? TRANSFER_COLOR : (t.category?.color ?? "#c7c9cf");
              const label = isOutgoingTransfer
                ? `Transfer to ${t.transferToAccount?.name ?? "another account"}`
                : isIncomingTransfer
                  ? `Transfer from ${t.account?.name ?? "another account"}`
                  : t.merchant;

              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3.5 border-b border-border-soft px-6 py-3 transition-colors last:border-b-0 hover:bg-surface-hover"
                >
                  <span
                    className="block w-[3px] shrink-0 self-stretch rounded-full"
                    style={{ background: barColor }}
                  />
                  <div className={`min-w-0 flex-1 truncate font-medium ${CELL_TEXT}`}>{label}</div>
                  <div className={`${COL_DATE} truncate text-text-muted ${CELL_TEXT}`}>{formatDate(t.date)}</div>
                  <div className={COL_CATEGORY}>
                    {t.type === "TRANSFER" ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border border-border-soft bg-surface-2 px-2.5 py-0.5 text-text-muted ${CELL_TEXT}`}
                      >
                        ↔ Transfer
                      </span>
                    ) : canEdit ? (
                      <CategoryCell
                        categoryId={t.categoryId}
                        categories={categories ?? []}
                        onChange={(categoryId) => updateTransaction.mutate({ id: t.id, categoryId })}
                      />
                    ) : (
                      <span className={`truncate text-text-muted ${CELL_TEXT}`}>
                        {t.category?.name ?? "No category"}
                      </span>
                    )}
                  </div>
                  <div
                    className={`${COL_AMOUNT} truncate font-semibold tabular-nums ${CELL_TEXT} ${
                      isInflow ? "text-good" : ""
                    }`}
                  >
                    {isInflow ? "+" : "−"} {formatEUR(Number(t.amount))}
                  </div>
                  <div className={COL_ACTIONS}>
                    {canEdit && (
                      <button
                        onClick={() => {
                          if (confirm("Delete this transaction?")) deleteTransaction.mutate({ id: t.id });
                        }}
                        className="text-[12px] text-text-muted hover:text-critical"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";

import { trpc } from "@/trpc/react";
import { Modal, ModalFooter } from "@/components/modal";
import { Field, SelectInput, inputClass } from "@/components/settings/form";
import { SCHEDULE_UNITS, unitLabel, type ScheduleUnit } from "@/lib/schedule";
import { cleanMerchant } from "@/lib/csv";
import { formatEUR } from "@/lib/format";
import type { Category } from "@/components/finance/category-cell";

export type RecurringSource = {
  id: string;
  merchant: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  amount: number;
  date: Date | string;
  categoryId: string | null;
  accountId: string;
  accountName: string;
  /** For a transfer: where the money arrives. */
  toAccountId?: string | null;
  toAccountName?: string;
};

/**
 * "This repeats": turns a transaction into a recurring income or expense,
 * prefilled from it — name, amount, category, and the account it runs through.
 * The merchant text is remembered so the same transaction isn't suggested
 * again, and the transaction's date is the starting point for the next due date.
 */
export function MarkRecurringModal({
  source,
  categories,
  onClose,
  onDone,
}: {
  source: RecurringSource;
  categories: Category[];
  onClose: () => void;
  onDone: (result: { name: string; type: "EXPENSE" | "INCOME" | "TRANSFER" }) => void;
}) {
  const utils = trpc.useUtils();
  const isIncome = source.type === "INCOME";
  const isTransfer = source.type === "TRANSFER";
  const [error, setError] = useState<string | null>(null);
  const [intervalCount, setIntervalCount] = useState("1");
  const [intervalUnit, setIntervalUnit] = useState<ScheduleUnit>("MONTH");

  const create = trpc.recurring.create.useMutation({
    onSuccess: (_item, vars) => {
      utils.recurring.list.invalidate();
      utils.recurring.suggestions.invalidate();
      onDone({ name: vars.name, type: vars.type });
    },
    onError: (err) => setError(err.message),
  });

  return (
    <Modal
      title={isTransfer ? "Mark as recurring transfer" : isIncome ? "Mark as recurring income" : "Mark as recurring expense"}
      onClose={onClose}
    >
      <form
        className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const form = new FormData(e.currentTarget);
          const amount = Number(String(form.get("amount")).replace(",", "."));
          if (!(amount > 0)) {
            setError("Enter an amount above zero.");
            return;
          }
          create.mutate({
            name: String(form.get("name")).trim(),
            type: source.type,
            amount,
            intervalCount: Math.max(1, Math.min(365, Math.round(Number(intervalCount) || 1))),
            intervalUnit,
            categoryId: isTransfer ? null : String(form.get("categoryId") || "") || null,
            accountId: source.accountId,
            toAccountId: isTransfer ? source.toAccountId : undefined,
            // The other transactions of the same party are recognised from this one.
            fromTransactionId: source.id,
            lastDate: new Date(source.date),
          });
        }}
      >
        <p className="col-span-full -mt-1 text-[13px] text-text-muted">
          From {source.accountName} · {formatEUR(source.amount)} on{" "}
          {new Date(source.date).toLocaleDateString("en-GB")}. It will show up under Budgets
          {isTransfer
            ? " as an expense for the account it leaves and income for the account it enters"
            : isIncome
              ? " as recurring income"
              : " as a recurring expense"}
          .
        </p>
        <div className="col-span-full">
          <Field label="Name">
            <input
              name="name"
              required
              autoFocus
              maxLength={120}
              defaultValue={isTransfer ? `Transfer to ${source.toAccountName ?? "another account"}` : cleanMerchant(source.merchant)}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="How often">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-text-muted">Every</span>
            <input
              type="number"
              min={1}
              max={365}
              value={intervalCount}
              onChange={(e) => setIntervalCount(e.target.value)}
              aria-label="Every how many"
              className={`${inputClass} w-20`}
            />
            <SelectInput value={intervalUnit} onChange={(e) => setIntervalUnit(e.target.value as ScheduleUnit)}>
              {SCHEDULE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {unitLabel(u, Number(intervalCount) || 1)}
                </option>
              ))}
            </SelectInput>
          </div>
        </Field>
        <Field label="Amount (€)">
          <input
            name="amount"
            required
            inputMode="decimal"
            defaultValue={source.amount.toFixed(2)}
            className={inputClass}
          />
        </Field>
        <div className={`col-span-full ${isTransfer ? "hidden" : ""}`}>
          <Field label="Category (optional)">
            <SelectInput name="categoryId" defaultValue={source.categoryId ?? ""}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        {error && (
          <p className="col-span-full rounded-xl border border-critical/30 bg-critical/10 px-3.5 py-2.5 text-[13px] text-critical">
            {error}
          </p>
        )}

        <ModalFooter className="col-span-full">
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-xl bg-accent-fill px-5 py-2.5 text-[13.5px] font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
          >
            {create.isPending ? "Saving…" : "Mark as recurring"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-5 py-2.5 text-[13.5px] font-medium text-text-muted hover:bg-surface-hover hover:text-text"
          >
            Cancel
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

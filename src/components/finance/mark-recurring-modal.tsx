"use client";

import { useState } from "react";

import { trpc } from "@/trpc/react";
import { Modal, ModalFooter } from "@/components/modal";
import { Field, SelectInput, inputClass } from "@/components/settings/form";
import { RECURRING_FREQUENCY_LABELS, type RecurringFrequency } from "@/lib/constants";
import { cleanMerchant } from "@/lib/csv";
import { formatEUR } from "@/lib/format";
import type { Category } from "@/components/finance/category-cell";

export type RecurringSource = {
  id: string;
  merchant: string;
  type: "EXPENSE" | "INCOME";
  amount: number;
  date: Date | string;
  categoryId: string | null;
  accountId: string;
  accountName: string;
};

const FREQUENCIES = Object.keys(RECURRING_FREQUENCY_LABELS) as RecurringFrequency[];

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
  onDone: (result: { name: string; type: "EXPENSE" | "INCOME" }) => void;
}) {
  const utils = trpc.useUtils();
  const isIncome = source.type === "INCOME";
  const [error, setError] = useState<string | null>(null);

  const create = trpc.recurring.create.useMutation({
    onSuccess: (_item, vars) => {
      utils.recurring.list.invalidate();
      utils.recurring.suggestions.invalidate();
      onDone({ name: vars.name, type: vars.type });
    },
    onError: (err) => setError(err.message),
  });

  return (
    <Modal title={isIncome ? "Mark as recurring income" : "Mark as recurring expense"} onClose={onClose}>
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
            frequency: String(form.get("frequency")) as RecurringFrequency,
            categoryId: String(form.get("categoryId") || "") || null,
            accountId: source.accountId,
            detectedName: source.merchant,
            lastDate: new Date(source.date),
          });
        }}
      >
        <p className="col-span-full -mt-1 text-[13px] text-text-muted">
          From {source.accountName} · {formatEUR(source.amount)} on{" "}
          {new Date(source.date).toLocaleDateString("en-GB")}. It will show up under Budgets
          {isIncome ? " as recurring income" : " as a recurring expense"}.
        </p>
        <div className="col-span-full">
          <Field label="Name">
            <input
              name="name"
              required
              autoFocus
              maxLength={120}
              defaultValue={cleanMerchant(source.merchant)}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="How often">
          <SelectInput name="frequency" defaultValue="MONTHLY">
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {RECURRING_FREQUENCY_LABELS[f]}
              </option>
            ))}
          </SelectInput>
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
        <div className="col-span-full">
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

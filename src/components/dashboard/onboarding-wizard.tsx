"use client";

import { useState } from "react";

import { trpc } from "@/trpc/react";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@/lib/constants";

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [accountId, setAccountId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: categories } = trpc.category.list.useQuery();
  const { data: me } = trpc.user.me.useQuery();

  // Everything the wizard creates is the signing-up member's own (personal),
  // not shared: with no owner it silently became a joint account, which then
  // counted toward household totals and nagged every member about it.
  const createAccount = trpc.account.create.useMutation({
    onSuccess: (account) => {
      setAccountId(account.id);
      utils.account.list.invalidate();
      setStep(2);
    },
  });
  const createTransaction = trpc.transaction.create.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.dashboard.summary.invalidate();
      setStep(4);
    },
  });
  return (
    <div className="mx-auto max-w-[440px] rounded-[20px] border border-border-soft bg-surface p-7">
      <p className="mb-1 text-[11px] font-semibold tracking-[0.11em] text-accent uppercase">
        Step {Math.min(step, 2)} of 2
      </p>

      {step === 1 && (
        <>
          <h2 className="mb-2 font-display font-bold tracking-tight text-[22px]">Your first account</h2>
          <p className="mb-5 text-[13.5px] text-text-muted">
            Checking, savings, credit card — what would you like to start with?
          </p>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              createAccount.mutate({
                name: String(form.get("name")),
                institution: String(form.get("institution") || "") || undefined,
                type: String(form.get("type")) as (typeof ACCOUNT_TYPES)[number],
                startingBalance: Number(form.get("startingBalance") || 0),
                ownerId: me?.id ?? null,
              });
            }}
          >
            <input
              name="name"
              required
              placeholder="Account name, e.g. Checking"
              className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-accent"
            />
            <input
              name="institution"
              placeholder="Bank (optional)"
              className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-accent"
            />
            <select
              name="type"
              defaultValue="CHECKING"
              className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-accent"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              name="startingBalance"
              type="number"
              step="0.01"
              required
              placeholder="Starting balance (€)"
              className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={createAccount.isPending || !me}
              className="mt-1 rounded-xl bg-accent-fill py-2.5 text-[14px] font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
            >
              Continue
            </button>
          </form>
        </>
      )}

      {step === 2 && accountId && (
        <>
          <h2 className="mb-2 font-display font-bold tracking-tight text-[22px]">Your first transaction</h2>
          <p className="mb-5 text-[13.5px] text-text-muted">
            Add an expense or income — or skip this step.
          </p>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              createTransaction.mutate({
                accountId,
                type: String(form.get("type")) as "EXPENSE" | "INCOME",
                amount: Math.abs(Number(form.get("amount") || 0)),
                date: new Date(String(form.get("date"))),
                merchant: String(form.get("merchant")),
                categoryId: String(form.get("categoryId") || "") || undefined,
              });
            }}
          >
            <input
              name="merchant"
              required
              placeholder="Description, e.g. Supermarket"
              className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-accent"
            />
            <div className="flex gap-3">
              <select
                name="type"
                defaultValue="EXPENSE"
                className="flex-1 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-accent"
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
              <input
                name="amount"
                type="number"
                step="0.01"
                required
                placeholder="Amount (€)"
                className="flex-1 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-accent"
              />
            </div>
            <select
              name="categoryId"
              defaultValue=""
              className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-accent"
            >
              <option value="">Category (optional)</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              name="date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-accent"
            />
            <div className="mt-1 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex-1 rounded-xl border border-border-soft py-2.5 text-[14px] font-medium text-text-muted hover:text-text"
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={createTransaction.isPending}
                className="flex-1 rounded-xl bg-accent-fill py-2.5 text-[14px] font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
              >
                Continue
              </button>
            </div>
          </form>
        </>
      )}

      {step === 4 && (
        <div className="py-4 text-center">
          <p className="mb-1 font-display font-bold tracking-tight text-[22px]">You&apos;re all set</p>
          <p className="mb-5 text-[13.5px] text-text-muted">
            Your dashboard is ready.
          </p>
          <button
            onClick={onComplete}
            className="w-full rounded-xl bg-accent-fill py-2.5 text-[14px] font-semibold text-accent-ink hover:opacity-90"
          >
            Go to dashboard
          </button>
        </div>
      )}
    </div>
  );
}

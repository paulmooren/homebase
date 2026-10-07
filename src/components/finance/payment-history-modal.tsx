"use client";

import { useMemo, useState } from "react";

import { trpc } from "@/trpc/react";
import { Modal, ModalFooter } from "@/components/modal";
import { BASES, BASIS_WINDOW, amountForBasis, type BudgetBasis } from "@/lib/budget-basis";
import { formatEUR } from "@/lib/format";
import { parseMoney } from "@/lib/money";
import { monthlyEquivalent } from "@/lib/recurring";
import { describeSchedule } from "@/lib/schedule";

const BASIS_LABELS: Record<BudgetBasis, { title: string; hint: string }> = {
  LATEST: { title: "Latest", hint: "the most recent payment" },
  LOWEST: { title: "Lowest", hint: `the lowest of the last ${BASIS_WINDOW}` },
  HIGHEST: { title: "Highest", hint: `the highest of the last ${BASIS_WINDOW}` },
  AVERAGE: { title: "Average", hint: `the average of the last ${BASIS_WINDOW}` },
  FIXED: { title: "Fixed", hint: "an amount you type" },
};

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * What an item has actually been paid, and what to budget for it: the
 * payments as bars and a list (a one-off can be set aside), the five ways to
 * take the Budgeted amount from them, and what the choice comes to per month.
 */
export function PaymentHistoryModal({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data } = trpc.recurring.history.useQuery({ id: itemId });
  const [picked, setPicked] = useState<BudgetBasis | null>(null);
  const [typed, setTyped] = useState<string | null>(null);

  const refresh = () => {
    utils.recurring.history.invalidate({ id: itemId });
    utils.recurring.list.invalidate();
    utils.transaction.list.invalidate();
  };
  const setBasis = trpc.recurring.setBasis.useMutation({
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  const setAside = trpc.recurring.setPaymentExcluded.useMutation({ onSuccess: refresh });

  const counted = useMemo(() => (data?.payments ?? []).filter((p) => !p.excluded).map((p) => p.amount), [data]);
  const basis = picked ?? data?.basis ?? "LATEST";
  const fixedText = typed ?? (data ? String(data.amount) : "");
  const fixedAmount = parseMoney(fixedText);
  const resulting = basis === "FIXED" ? fixedAmount : amountForBasis(basis, counted);

  if (!data) {
    return (
      <Modal title="Payment history" onClose={onClose}>
        <p className="py-8 text-center text-[13px] text-text-muted">Loading…</p>
      </Modal>
    );
  }

  const maxAmount = Math.max(...data.payments.map((p) => p.amount), 1);
  const monthly = resulting ? monthlyEquivalent(resulting, data.intervalCount, data.intervalUnit) : null;
  // Nothing to save when the same basis already gives the amount that is budgeted (a pending new amount is something to save).
  const unchanged = basis === data.basis && resulting !== null && resulting === data.amount;
  const recentStart = Math.max(0, data.payments.filter((p) => !p.excluded).length - BASIS_WINDOW);
  let seen = 0;

  return (
    <Modal title={data.name} onClose={onClose} width="max-w-2xl">
      <div className="flex flex-col gap-5 pb-4">
        {/* The payments, oldest to newest. Set-aside ones are faded; the ones a basis looks at are solid. */}
        <div>
          <p className="mb-2 text-[12.5px] text-text-muted">
            {data.payments.length} payment{data.payments.length === 1 ? "" : "s"} · {describeSchedule(data.intervalCount, data.intervalUnit).toLowerCase()}
          </p>
          {/* Headroom above the bars (pt-14) keeps the tooltip of the tallest one inside the chart. */}
          <div className="flex h-40 items-stretch gap-1.5 rounded-xl bg-surface-2 px-3 pt-14 pb-2" aria-hidden>
            {data.payments.map((p) => {
              const inWindow = !p.excluded && seen++ >= recentStart;
              const height = Math.max(4, (p.amount / maxAmount) * 100);
              return (
                <div key={p.id} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div className="relative flex w-full flex-1 items-end justify-center">
                    <div
                      className={`w-full max-w-9 rounded-t-md transition-opacity group-hover:opacity-80 ${
                        p.excluded ? "bg-text-faint/30" : inWindow ? "bg-text" : "bg-text-faint/60"
                      }`}
                      style={{ height: `${height}%` }}
                    />
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute left-1/2 z-20 hidden -translate-x-1/2 rounded-lg bg-text px-2.5 py-1.5 text-center text-[11.5px] font-medium whitespace-nowrap text-bg shadow-lg group-hover:block"
                      style={{ bottom: `calc(${height}% + 6px)` }}
                    >
                      {formatEUR(p.amount)}
                      <span className="block text-[10.5px] font-normal text-bg/70">
                        {DAY.format(new Date(p.date))}
                        {p.excluded && " · set aside"}
                      </span>
                    </span>
                  </div>
                  <span className="text-[10px] text-text-faint">{MONTH.format(new Date(p.date))}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
            What to budget
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Budgeted amount basis">
            {BASES.map((b) => {
              const amount = b === "FIXED" ? fixedAmount : amountForBasis(b, counted);
              const active = basis === b;
              return (
                <label
                  key={b}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                    active ? "border-text" : "border-border-soft hover:bg-surface-hover"
                  } ${!data.canEdit ? "pointer-events-none opacity-70" : ""}`}
                >
                  <input
                    type="radio"
                    name="basis"
                    checked={active}
                    onChange={() => setPicked(b)}
                    className="h-4 w-4 shrink-0 accent-[var(--accent-fill)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium">{BASIS_LABELS[b].title}</p>
                    <p className="text-[11.5px] text-text-muted">{BASIS_LABELS[b].hint}</p>
                  </div>
                  {b === "FIXED" ? (
                    <input
                      value={fixedText}
                      onChange={(e) => {
                        setTyped(e.target.value);
                        setPicked("FIXED");
                      }}
                      inputMode="decimal"
                      aria-label="Fixed amount"
                      className="w-24 rounded-lg border border-border-soft bg-surface px-2 py-1 text-right text-[13.5px] font-semibold tabular-nums outline-none focus:border-text-faint"
                    />
                  ) : (
                    <span className="text-[13.5px] font-semibold tabular-nums">
                      {amount === null ? "—" : formatEUR(amount)}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <p className="mt-3 text-[13px] text-text-muted">
            {monthly === null ? (
              "Nothing to budget with this choice yet."
            ) : (
              <>
                <span className="font-semibold text-text">{formatEUR(monthly)}</span> per month in your budget
                {resulting !== null && monthly !== resulting && ` (${formatEUR(resulting)} ${describeSchedule(data.intervalCount, data.intervalUnit).toLowerCase()})`}
              </>
            )}
          </p>
        </div>

        <div>
          <p className="mb-1 text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">Payments</p>
          <p className="mb-2 text-[12px] text-text-muted">
            A one-off (a bonus, a refund)? Set it aside: it stays a transaction but no longer counts here.
          </p>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-border-soft">
            {[...data.payments].reverse().map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 border-b border-border-soft px-3.5 py-2 text-[13px] last:border-b-0 ${
                  p.excluded ? "text-text-faint" : ""
                }`}
              >
                <span className="w-24 shrink-0 text-text-muted tabular-nums">{DAY.format(new Date(p.date))}</span>
                <span className="min-w-0 flex-1 truncate">{p.merchant}</span>
                <span className={`font-medium tabular-nums ${p.excluded ? "line-through" : ""}`}>{formatEUR(p.amount)}</span>
                {data.canEdit && (
                  <button
                    type="button"
                    disabled={setAside.isPending}
                    onClick={() => setAside.mutate({ transactionId: p.id, excluded: !p.excluded })}
                    className="w-24 shrink-0 text-right text-[12px] font-medium text-text-muted hover:text-text"
                  >
                    {p.excluded ? "Include again" : "Set aside"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {setBasis.error && (
          <p className="rounded-xl border border-critical/30 bg-critical/10 px-3.5 py-2.5 text-[13px] text-critical">
            {setBasis.error.message}
          </p>
        )}
      </div>

      <ModalFooter>
        {data.canEdit && (
          <button
            type="button"
            disabled={setBasis.isPending || resulting === null || resulting <= 0 || unchanged}
            onClick={() =>
              setBasis.mutate({ id: itemId, basis, amount: basis === "FIXED" ? (fixedAmount ?? undefined) : undefined })
            }
            className="rounded-xl bg-accent-fill px-5 py-2.5 text-[13.5px] font-semibold text-accent-ink hover:opacity-90 disabled:bg-surface-2 disabled:text-text-faint"
          >
            {setBasis.isPending ? "Saving…" : resulting !== null ? `Budget ${formatEUR(resulting)}` : "Use this"}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-border px-5 py-2.5 text-[13.5px] font-medium text-text-muted hover:bg-surface-hover hover:text-text"
        >
          {data.canEdit ? "Cancel" : "Close"}
        </button>
      </ModalFooter>
    </Modal>
  );
}

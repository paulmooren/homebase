"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import { trpc } from "@/trpc/react";
import { Toast, toastPrimary, toastSecondary } from "@/components/toast";
import { suggestCategoryId } from "@/lib/categorize";
import { readStatement } from "@/lib/statement-import";

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="7.5" x2="12" y2="13" />
      <circle cx="12" cy="16.3" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function lastMonthName() {
  const now = new Date();
  return MONTH_NAMES[(now.getMonth() + 11) % 12];
}

type Outcome =
  | { kind: "success"; accountId: string; accountName: string; imported: number; skipped: number }
  | { kind: "error"; accountId: string; message: string };

/**
 * A full-width alert banner (not a card) for each account missing last
 * month's statement — stays up from the 1st of the month until that
 * account has a transaction dated last month (`dashboard.missingStatements`
 * is pure date-math re-evaluated on every load, so there's no dismissed/seen
 * state to track: it simply stops being true once imported). Named apart
 * from "Reminders" (recurring Tasks) — same word, unrelated concepts.
 *
 * "Import statement" opens the file picker right here; the file is read,
 * columns are guessed, and the rows are imported without leaving the
 * dashboard. A toast then confirms and links to the transactions.
 */
export function MissingStatementsCard() {
  const utils = trpc.useUtils();
  const { data: missingStatements } = trpc.dashboard.missingStatements.useQuery();
  const { data: categories } = trpc.category.list.useQuery();
  const [busyAccount, setBusyAccount] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const targetAccount = useRef<{ id: string; name: string } | null>(null);

  const importCsv = trpc.transaction.importCsv.useMutation();

  async function handleFile(file: File) {
    const account = targetAccount.current;
    if (!account) return;
    setOutcome(null);
    setBusyAccount(account.id);
    try {
      const statement = await readStatement(file);
      if (!statement.ok) {
        setOutcome({ kind: "error", accountId: account.id, message: statement.error });
        return;
      }
      const result = await importCsv.mutateAsync({
        accountId: account.id,
        rows: statement.rows.map((r) => ({
          ...r,
          categoryId: suggestCategoryId(r.merchant, categories ?? []) ?? undefined,
        })),
      });
      // Confirm straight away; the screen catches up with the new data in the background.
      void Promise.all([
        utils.dashboard.missingStatements.invalidate(),
        utils.dashboard.summary.invalidate(),
        utils.dashboard.netWorthHistory.invalidate(),
        utils.transaction.list.invalidate(),
        utils.account.list.invalidate(),
        utils.budget.list.invalidate(),
      ]);
      setOutcome({
        kind: "success",
        accountId: account.id,
        accountName: account.name,
        imported: result.imported,
        skipped: statement.skipped,
      });
    } catch {
      setOutcome({ kind: "error", accountId: account.id, message: "Something went wrong importing that file." });
    } finally {
      setBusyAccount(null);
    }
  }

  const month = lastMonthName();
  const hasBanners = !!missingStatements && missingStatements.length > 0;
  if (!hasBanners && !outcome) return null;

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="Bank statement CSV"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />

      {hasBanners && (
        <div className="flex flex-col gap-3">
          {missingStatements.map((r) => (
            <div
              key={r.accountId}
              className="flex flex-wrap items-center gap-3 rounded-[14px] border border-warn/30 bg-warn/10 px-5 py-3.5"
            >
              <span className="block h-5 w-5 shrink-0 text-warn">
                <WarningIcon />
              </span>
              <p className="min-w-0 flex-1 text-[13.5px] leading-snug">
                <span className="font-semibold">Missing {month}&apos;s statement</span>{" "}
                <span className="text-text-muted">
                  — {r.accountName} has no transactions recorded for {month}.
                </span>
              </p>
              <button
                type="button"
                disabled={busyAccount !== null}
                onClick={() => {
                  targetAccount.current = { id: r.accountId, name: r.accountName };
                  fileInput.current?.click();
                }}
                className="shrink-0 rounded-lg bg-accent-fill px-4 py-2 text-[12.5px] font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
              >
                {busyAccount === r.accountId ? "Importing…" : "Import statement"}
              </button>
            </div>
          ))}
        </div>
      )}

      {outcome?.kind === "success" && (
        <Toast
          onClose={() => setOutcome(null)}
          actions={
            <>
              <Link
                href={`/finance/transactions?account=${outcome.accountId}`}
                onClick={() => setOutcome(null)}
                className={toastPrimary}
              >
                View transactions
              </Link>
              <button type="button" onClick={() => setOutcome(null)} className={toastSecondary}>
                Close
              </button>
            </>
          }
        >
          <p className="font-semibold">
            ✓ Imported {outcome.imported} transaction{outcome.imported === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 text-bg/75">
            Added to {outcome.accountName}
            {outcome.skipped > 0 && ` · ${outcome.skipped} row${outcome.skipped === 1 ? "" : "s"} skipped (no date or amount)`}
          </p>
        </Toast>
      )}

      {outcome?.kind === "error" && (
        <Toast
          onClose={() => setOutcome(null)}
          actions={
            <>
              <Link
                href={`/finance/transactions?import=${outcome.accountId}`}
                onClick={() => setOutcome(null)}
                className={toastPrimary}
              >
                Open the importer
              </Link>
              <button type="button" onClick={() => setOutcome(null)} className={toastSecondary}>
                Close
              </button>
            </>
          }
        >
          <p className="font-semibold">Couldn&apos;t import that file</p>
          <p className="mt-0.5 text-bg/75">{outcome.message}</p>
        </Toast>
      )}
    </>
  );
}

"use client";

import Link from "next/link";

import { trpc } from "@/trpc/react";

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

/**
 * A full-width alert banner (not a card) for each account missing last
 * month's statement — stays up from the 1st of the month until that
 * account has a transaction dated last month (`dashboard.reminders` is
 * pure date-math re-evaluated on every load, so there's no dismissed/seen
 * state to track: it simply stops being true once imported).
 */
export function RemindersCard() {
  const { data: reminders } = trpc.dashboard.reminders.useQuery();

  if (!reminders || reminders.length === 0) return null;

  const month = lastMonthName();

  return (
    <div className="mb-5 flex flex-col gap-3">
      {reminders.map((r) => (
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
          <Link
            href={`/finance/transactions?import=${r.accountId}`}
            className="shrink-0 rounded-lg bg-accent-fill px-4 py-2 text-[12.5px] font-semibold text-accent-ink hover:opacity-90"
          >
            Import statement
          </Link>
        </div>
      ))}
    </div>
  );
}

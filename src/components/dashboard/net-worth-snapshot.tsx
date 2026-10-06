"use client";

import Link from "next/link";

import { trpc } from "@/trpc/react";
import { formatEUR } from "@/lib/format";

/**
 * Compact, non-interactive snapshot — the full chart lives in Finance now.
 * "Household" is shared/joint accounts only (dashboard.summary's netWorth,
 * unchanged math); "Yours" is a client-side sum over the same payload's
 * accounts, filtered to what this viewer owns — no separate endpoint needed.
 */
export function NetWorthSnapshot() {
  const { data: me } = trpc.user.me.useQuery();
  const { data: summary } = trpc.dashboard.summary.useQuery();

  if (!summary) return null;

  const yours = summary.accounts
    .filter((a) => a.ownerId === me?.id)
    .reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <Link
      href="/finance/accounts"
      className="grid grid-cols-2 gap-4 rounded-[20px] border border-border-soft bg-surface p-6 transition-colors hover:bg-surface-hover"
    >
      <div>
        <p className="mb-1.5 text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
          Yours
        </p>
        <p className="font-display font-bold tracking-tight text-[26px] tabular-nums">{formatEUR(yours)}</p>
      </div>
      <div>
        <p className="mb-1.5 text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
          Household
        </p>
        <p className="font-display font-bold tracking-tight text-[26px] tabular-nums">{formatEUR(Number(summary.netWorth))}</p>
      </div>
    </Link>
  );
}

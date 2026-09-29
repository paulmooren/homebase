"use client";

import { useMemo, useState } from "react";

import { trpc } from "@/trpc/react";
import { BalanceChart, type BalancePoint, type Granularity } from "@/components/balance-chart";

export function NetWorthCard() {
  const [range, setRange] = useState<{ from: Date; to: Date; granularity: Granularity } | null>(null);

  const { data: summary } = trpc.dashboard.summary.useQuery();
  const { data: history } = trpc.dashboard.netWorthHistory.useQuery(range!, { enabled: !!range });

  const data: BalancePoint[] | undefined = useMemo(
    () => history?.map((h) => ({ date: h.date, value: Number(h.netWorth) })),
    [history],
  );

  return (
    <BalanceChart
      label="Net Worth"
      data={data}
      currentValue={summary ? Number(summary.netWorth) : 0}
      onRangeChange={setRange}
    />
  );
}

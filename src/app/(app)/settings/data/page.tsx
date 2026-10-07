"use client";

import { useRouter } from "next/navigation";

import { trpc } from "@/trpc/react";
import { SettingsSection } from "@/components/settings/form";
import { IS_DEMO_CLIENT } from "@/lib/demo";

export default function DataSettingsPage() {
  const utils = trpc.useUtils();

  async function exportJson() {
    const data = await utils.user.exportData.fetch();
    downloadBlob(JSON.stringify(data, null, 2), "homebase-export.json", "application/json");
  }

  async function exportCsv() {
    const transactions = await utils.transaction.list.fetch({ limit: 200 });
    const header = "Date,Description,Category,Type,Amount\n";
    const body = transactions
      .map((t) =>
        [
          new Date(t.date).toISOString().slice(0, 10),
          `"${t.merchant.replace(/"/g, '""')}"`,
          t.category?.name ?? "",
          t.type,
          Number(t.amount).toFixed(2),
        ].join(","),
      )
      .join("\n");
    downloadBlob(header + body, "homebase-transactions.csv", "text/csv");
  }

  return (
    <>
    {IS_DEMO_CLIENT && <ResetDemo />}
    <SettingsSection title="Export data">
      <p className="-mt-2 text-[13px] text-text-muted">Your data belongs to you — download it anytime.</p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={exportCsv}
          className="rounded-xl border border-border-soft px-5 py-2.5 text-[13.5px] font-medium hover:bg-surface-2"
        >
          Transactions (CSV)
        </button>
        <button
          onClick={exportJson}
          className="rounded-xl border border-border-soft px-5 py-2.5 text-[13.5px] font-medium hover:bg-surface-2"
        >
          All data (JSON)
        </button>
      </div>
    </SettingsSection>
    </>
  );
}

/** Demo only: throw away every change and start again from the made-up household, dated relative to today. */
function ResetDemo() {
  const utils = trpc.useUtils();
  const router = useRouter();
  const reset = trpc.demo.reset.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      router.push("/dashboard");
    },
  });
  return (
    <SettingsSection title="Reset demo">
      <p className="-mt-2 text-[13px] text-text-muted">
        Undoes every change made while showing the app and starts again from the made-up household, with dates
        brought up to today.
      </p>
      <div>
        <button
          onClick={() => reset.mutate()}
          disabled={reset.isPending}
          className="rounded-xl bg-accent-fill px-5 py-2.5 text-[13.5px] font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
        >
          {reset.isPending ? "Resetting…" : "Reset demo"}
        </button>
        {reset.error && <p className="mt-2 text-[13px] text-critical">{reset.error.message}</p>}
      </div>
    </SettingsSection>
  );
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

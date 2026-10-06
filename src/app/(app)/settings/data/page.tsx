"use client";

import { trpc } from "@/trpc/react";
import { SettingsSection } from "@/components/settings/form";

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

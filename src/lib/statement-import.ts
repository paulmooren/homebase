import Papa from "papaparse";

import { detectColumns, parseAmount, parseFlexibleDate } from "@/lib/csv";

export type StatementRow = { date: Date; merchant: string; amount: number };

export type StatementResult =
  | { ok: true; rows: StatementRow[]; skipped: number }
  | { ok: false; error: string };

/**
 * Reads a bank statement CSV in one go, with the same column guessing the
 * manual importer starts from. Used by the dashboard's one-click import,
 * which has no mapping screen — if nothing usable comes out, the caller falls
 * back to the full importer.
 */
export async function readStatement(file: File): Promise<StatementResult> {
  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, delimiter: "" });
  const fields = parsed.meta.fields ?? [];
  if (fields.length === 0 || parsed.data.length === 0) {
    return { ok: false, error: "Couldn't read that file. Is it a CSV export from your bank?" };
  }

  const { dateCol, merchantCol, merchantFallbackCol, amountCol } = detectColumns(fields);
  const rows: StatementRow[] = [];
  let skipped = 0;
  for (const row of parsed.data) {
    const date = parseFlexibleDate(row[dateCol] ?? "");
    const amount = parseAmount(row[amountCol] ?? "");
    const merchant =
      (row[merchantCol] ?? "").trim() || (merchantFallbackCol ? (row[merchantFallbackCol] ?? "").trim() : "") || "Transaction";
    if (!date || Number.isNaN(amount)) {
      skipped += 1;
      continue;
    }
    rows.push({ date, merchant, amount });
  }

  if (rows.length === 0) {
    return { ok: false, error: "Couldn't find dates and amounts in that file." };
  }
  return { ok: true, rows, skipped };
}

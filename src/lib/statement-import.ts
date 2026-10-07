import Papa from "papaparse";

import {
  cleanMerchant,
  detectColumns,
  detectPartyColumns,
  normalizeIban,
  parseAmount,
  parseFlexibleDate,
} from "@/lib/csv";

export type StatementRow = {
  date: Date;
  merchant: string;
  amount: number;
  counterpartyIban: string | null;
  counterpartyName: string | null;
};

/** The IBAN the statement says it is for: the most common valid one in its account column. */
export function statementIban(rows: Record<string, string>[], accountIbanCol: string): string | null {
  if (!accountIbanCol) return null;
  const counts = new Map<string, number>();
  for (const row of rows) {
    const iban = normalizeIban(row[accountIbanCol]);
    if (iban) counts.set(iban, (counts.get(iban) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export type ParsedStatementText = { fields: string[]; rows: Record<string, string>[] };

/**
 * Parses statement CSV text into header names and row objects.
 *
 * Some bank exports (bunq) wrap every value in quotes but write a quoted
 * description as `""Text""`, which a strict CSV parser reads as the start of a
 * long quoted field — it then swallows following lines and returns less than
 * half the rows. When every line is `"a","b","c"` with the same number of
 * fields, splitting on `","` is exact, so that is used; anything else goes
 * through Papa Parse.
 */
export function parseStatementText(text: string): ParsedStatementText | null {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (lines.length < 2) return null;

  if (lines.every((l) => l.startsWith('"') && l.endsWith('"'))) {
    const split = lines.map((l) => l.slice(1, -1).split('","'));
    const width = split[0].length;
    if (width > 1 && split.every((r) => r.length === width)) {
      const fields = split[0];
      const rows = split.slice(1).map((r) => Object.fromEntries(fields.map((f, i) => [f, r[i] ?? ""])));
      return { fields, rows };
    }
  }

  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, delimiter: "" });
  const fields = parsed.meta.fields ?? [];
  if (fields.length === 0 || parsed.data.length === 0) return null;
  return { fields, rows: parsed.data };
}

export type StatementResult =
  | { ok: true; rows: StatementRow[]; skipped: number; accountIban: string | null }
  | { ok: false; error: string };

/**
 * Reads a bank statement CSV in one go, with the same column guessing the
 * manual importer starts from. Used by the dashboard's one-click import,
 * which has no mapping screen — if nothing usable comes out, the caller falls
 * back to the full importer.
 */
export async function readStatement(file: File): Promise<StatementResult> {
  const text = await file.text();
  const parsed = parseStatementText(text);
  if (!parsed) {
    return { ok: false, error: "Couldn't read that file. Is it a CSV export from your bank?" };
  }
  const { fields } = parsed;

  const { dateCol, merchantCol, merchantFallbackCol, amountCol } = detectColumns(fields);
  const { accountIbanCol, counterpartyIbanCol, counterpartyNameCol } = detectPartyColumns(fields);
  const rows: StatementRow[] = [];
  let skipped = 0;
  for (const row of parsed.rows) {
    const date = parseFlexibleDate(row[dateCol] ?? "");
    const amount = parseAmount(row[amountCol] ?? "");
    const merchant =
      cleanMerchant(row[merchantCol] ?? "") ||
      (merchantFallbackCol ? cleanMerchant(row[merchantFallbackCol] ?? "") : "") ||
      "Transaction";
    if (!date || Number.isNaN(amount)) {
      skipped += 1;
      continue;
    }
    rows.push({
      date,
      merchant,
      amount,
      counterpartyIban: counterpartyIbanCol ? normalizeIban(row[counterpartyIbanCol]) : null,
      counterpartyName: counterpartyNameCol ? cleanMerchant(row[counterpartyNameCol] ?? "") || null : null,
    });
  }

  if (rows.length === 0) {
    return { ok: false, error: "Couldn't find dates and amounts in that file." };
  }
  return { ok: true, rows, skipped, accountIban: statementIban(parsed.rows, accountIbanCol) };
}

export type ImportResult = {
  added: number;
  updated: number;
  unchanged: number;
  transfers: number;
  removed: number;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What an import did, in words: "Added 12 new, updated 3 existing". */
export function describeImport(result: ImportResult): { headline: string; detail: string | null } {
  const parts = [
    result.added > 0 ? `added ${result.added} new` : null,
    result.updated > 0 ? `updated ${result.updated} existing` : null,
  ].filter(Boolean) as string[];
  const headline =
    parts.length > 0
      ? parts.join(", ").replace(/^./, (c) => c.toUpperCase())
      : "Nothing new — it was all imported already";
  const detail =
    result.transfers > 0
      ? `${plural(result.transfers, "move")} between your accounts kept as one transfer`
      : null;
  return { headline, detail };
}

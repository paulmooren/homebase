/**
 * Bank CSV exports vary a lot (semicolon vs comma delimiter, "1.234,56" vs
 * "1234.56", "24.09.2026" vs "2026-09-24") — these heuristics cover the common
 * German and ISO conventions without needing per-bank code.
 */
export function parseAmount(raw: string): number {
  const trimmed = raw.trim().replace(/[€\s]/g, "");
  if (trimmed === "") return NaN;

  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");

  let normalized = trimmed;
  if (hasComma && hasDot) {
    // Whichever separator appears last is the decimal point.
    const lastComma = trimmed.lastIndexOf(",");
    const lastDot = trimmed.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = trimmed.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = trimmed.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  }

  return parseFloat(normalized);
}

export function parseFlexibleDate(raw: string): Date | null {
  const trimmed = raw.trim();

  // DD.MM.YYYY or DD.MM.YY
  const de = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (de) {
    const [, d, m, y] = de;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    return new Date(Date.UTC(year, Number(m) - 1, Number(d)));
  }

  // YYYY-MM-DD (ISO)
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }

  // DD/MM/YYYY
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, d, m, y] = slash;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }

  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function guessColumn(headers: string[], keywords: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h.includes(kw));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

/**
 * Which column of a bank export holds what, guessed from the header names.
 * Some banks (e.g. bunq) leave the description blank for internal transfers
 * and only fill a separate payer/payee name column — `merchantFallbackCol` is
 * used for those rows so they aren't dropped for having an empty merchant.
 */
export function detectColumns(fields: string[]) {
  return {
    dateCol: guessColumn(fields, ["datum", "date", "buchungstag"]) ?? fields[0],
    merchantCol:
      guessColumn(fields, ["beschreibung", "verwendungszweck", "buchungstext", "merchant", "description"]) ??
      fields[1] ??
      fields[0],
    merchantFallbackCol:
      guessColumn(fields, ["name", "gegenpartei", "counterparty", "tegenpartij", "empfänger", "begünstigter", "payee"]) ?? "",
    amountCol: guessColumn(fields, ["betrag", "amount", "wert"]) ?? fields[fields.length - 1],
  };
}

const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;

/** An IBAN without spaces in capitals, or null when the text isn't one. */
export function normalizeIban(raw: string | null | undefined): string | null {
  const iban = (raw ?? "").replace(/\s+/g, "").toUpperCase();
  return IBAN_PATTERN.test(iban) ? iban : null;
}

function exactColumn(headers: string[], names: string[]): string {
  return headers.find((h) => names.includes(h.trim().toLowerCase())) ?? "";
}

/**
 * The columns that say who a transaction was with: the statement's own IBAN
 * (bunq: "Account"), the other party's IBAN ("Counterparty") and name
 * ("Name"). Matched by whole header so a "Counterparty name" column is never
 * mistaken for the IBAN. Empty string when a bank doesn't export one.
 */
export function detectPartyColumns(fields: string[]) {
  return {
    accountIbanCol: exactColumn(fields, ["account", "iban", "account number", "rekeningnummer", "konto"]),
    counterpartyIbanCol: exactColumn(fields, [
      "counterparty",
      "counterparty iban",
      "tegenrekening",
      "tegenrekeningnummer",
      "iban/bic",
    ]),
    counterpartyNameCol: exactColumn(fields, [
      "name",
      "counterparty name",
      "naam tegenpartij",
      "naam",
      "tegenpartij",
      "gegenpartei",
      "empfänger",
      "begünstigter",
      "payee",
    ]),
  };
}

export const MAX_MERCHANT_LENGTH = 120;

/**
 * Tidies a bank's description text into a merchant name: stray double quotes
 * (some exports wrap or repeat them), runs of spaces, and anything past the
 * length limit — a single long description must never reject a whole import.
 */
export function cleanMerchant(raw: string): string {
  return raw.replace(/"/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_MERCHANT_LENGTH).trim();
}

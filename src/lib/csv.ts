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

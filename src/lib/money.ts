/**
 * Reads an amount the way people type or see it: "€1,250.50", "1.250,50",
 * "1250,50" and "1250.5" all work. The last separator is the decimal one,
 * unless it is the only separator and has exactly three digits after it
 * ("1,250" / "1.250" → 1250). Returns null when there is no number at all.
 */
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  const decimalAt = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  if (decimalAt === -1) return Number(cleaned);

  const after = cleaned.slice(decimalAt + 1);
  const separators = cleaned.replace(/\d/g, "");
  const isThousandsOnly = after.length === 3 && separators.length === 1;
  const normalized = isThousandsOnly
    ? cleaned.replace(/[.,]/g, "")
    : `${cleaned.slice(0, decimalAt).replace(/[.,]/g, "")}.${after}`;

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

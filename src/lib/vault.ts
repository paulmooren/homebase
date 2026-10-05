export const VAULT_CATEGORIES = ["ID", "Insurance", "Bank", "Utility", "Vehicle", "Other"] as const;
export type VaultCategory = (typeof VAULT_CATEGORIES)[number];

/** Dashboard shows an expiry this many days ahead, and any that has already passed. */
export const VAULT_EXPIRY_WARNING_DAYS = 60;

/** Whole days from today (local) to a date-only value; negative once it has passed. */
export function daysUntil(date: Date | string): number {
  const d = new Date(date);
  const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export function expiryLabel(date: Date | string): { text: string; critical: boolean } {
  const days = daysUntil(date);
  if (days < 0) return { text: days === -1 ? "Expired yesterday" : `Expired ${-days} days ago`, critical: true };
  if (days === 0) return { text: "Expires today", critical: true };
  if (days <= VAULT_EXPIRY_WARNING_DAYS) return { text: `Expires in ${days} day${days === 1 ? "" : "s"}`, critical: true };
  return { text: `Expires in ${days} days`, critical: false };
}

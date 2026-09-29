export const CURRENCY = "EUR" as const;

export type AccountType =
  | "CHECKING"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "CASH"
  | "INVESTMENT"
  | "LOAN"
  | "MORTGAGE";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: "Checking Account",
  SAVINGS: "Savings Account",
  CREDIT_CARD: "Credit Card",
  CASH: "Cash",
  INVESTMENT: "Investment",
  LOAN: "Loan",
  MORTGAGE: "Mortgage",
};

export const ASSET_ACCOUNT_TYPES = [
  "CHECKING",
  "SAVINGS",
  "CASH",
  "INVESTMENT",
] as const;

export const LIABILITY_ACCOUNT_TYPES = [
  "CREDIT_CARD",
  "LOAN",
  "MORTGAGE",
] as const;

/** Seeded into every new household's category list on creation — flat, fully editable afterwards. */
export const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: "Housing & Utilities", color: "#c9976b" },
  { name: "Groceries", color: "#e0b04d" },
  { name: "Dining", color: "#eb9b5f" },
  { name: "Transport", color: "#7fb8e8" },
  { name: "Entertainment", color: "#6bc9c2" },
  { name: "Health", color: "#7fd6b8" },
  { name: "Shopping", color: "#f19abf" },
  { name: "Subscriptions", color: "#b79cff" },
  { name: "Travel", color: "#8f9bd6" },
  { name: "Income", color: "#6ee7a8" },
  { name: "Other", color: "#9a9da5" },
];

export const TRANSFER_COLOR = "#8d9099";

export type RecurringFrequency = "WEEKLY" | "MONTHLY" | "YEARLY";

export const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

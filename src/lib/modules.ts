/**
 * The Modules a Household can switch on or off. A Module's data is never
 * deleted when it is switched off — it is just hidden.
 */
export const MODULES = [
  {
    key: "finance",
    label: "Finance",
    description: "Accounts, transactions, and recurring income and expenses.",
  },
  {
    key: "tasks",
    label: "Tasks",
    description: "Things to do, and reminders that come back on a schedule.",
  },
  {
    key: "shopping",
    label: "Shopping list",
    description: "Shared and private lists of things to buy.",
  },
  {
    key: "wishlist",
    label: "Wishlist",
    description: "Everyone's wishes, with secret Claims so gifts stay a surprise.",
  },
  {
    key: "vault",
    label: "Vault",
    description: "Important numbers and notes — passports, policies, accounts — kept encrypted.",
  },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

export const MODULE_KEYS = MODULES.map((m) => m.key) as [ModuleKey, ...ModuleKey[]];

export function isModuleEnabled(disabledModules: readonly string[], key: ModuleKey) {
  return !disabledModules.includes(key);
}

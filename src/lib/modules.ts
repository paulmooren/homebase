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
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

export const MODULE_KEYS = MODULES.map((m) => m.key) as [ModuleKey, ...ModuleKey[]];

export function isModuleEnabled(disabledModules: readonly string[], key: ModuleKey) {
  return !disabledModules.includes(key);
}

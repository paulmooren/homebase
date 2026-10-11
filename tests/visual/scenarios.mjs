/**
 * Every screen and open state compared before and after the Base UI migration.
 * Selectors use accessible names (roles, labels), which the migration must keep, so the
 * same scenario runs unchanged on both sides. A scenario that changes data undoes itself (`cleanup`).
 */
export const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  phone: { width: 390, height: 844 },
};

const click = (name, opts = {}) => (page) => page.getByRole("button", { name, ...opts }).first().click();
const clickText = (text) => (page) => page.getByText(text, { exact: true }).first().click();
const dialogOpen = (page) => page.getByRole("dialog").first().waitFor({ timeout: 15_000 });

export const SCENARIOS = [
  // ── Screens ───────────────────────────────────────────────────────────────
  { name: "signin", persona: null, path: "/signin" },
  { name: "dashboard", persona: "Alex", path: "/dashboard", mask: ["h1"] },
  { name: "budgets-you", persona: "Alex", path: "/finance/budgets" },
  {
    name: "budgets-household",
    persona: "Alex",
    path: "/finance/budgets",
    run: (page) => page.getByRole("tab", { name: "Household" }).click(),
  },
  { name: "transactions", persona: "Alex", path: "/finance/transactions" },
  { name: "accounts", persona: "Alex", path: "/finance/accounts" },
  {
    name: "account-detail",
    persona: "Alex",
    path: "/finance/accounts",
    run: async (page) => {
      // Straight to the link: on a phone the sticky bar can sit over it, so a pointer click would wait forever.
      await page.locator('a[href^="/finance/accounts/"]').first().evaluate((el) => el.click());
      await page.waitForURL("**/finance/accounts/*");
    },
  },
  { name: "tasks", persona: "Alex", path: "/tasks" },
  { name: "shopping", persona: "Alex", path: "/lists/shopping" },
  { name: "wishlist", persona: "Alex", path: "/lists/wishlist" },
  { name: "vault", persona: "Alex", path: "/vault" },
  { name: "settings-profile", persona: "Alex", path: "/settings/profile" },
  { name: "settings-categories", persona: "Alex", path: "/settings/categories" },
  { name: "settings-household", persona: "Alex", path: "/settings/household" },
  { name: "settings-data", persona: "Alex", path: "/settings/data" },
  { name: "dashboard-sam", persona: "Sam", path: "/dashboard", mask: ["h1"], viewports: ["desktop"] },
  { name: "accounts-sam", persona: "Sam", path: "/finance/accounts", viewports: ["desktop"] },

  // ── Pop-ups, menus and other open states (desktop; a few also on the phone) ─
  { name: "modal-new-transaction", popup: true, persona: "Alex", path: "/finance/transactions", viewportOnly: true, run: async (p) => { await click("+ Transaction")(p); await dialogOpen(p); } },
  { name: "modal-import", popup: true, persona: "Alex", path: "/finance/transactions", viewportOnly: true, viewports: ["desktop"], run: async (p) => { await click("Import CSV")(p); await dialogOpen(p); } },
  { name: "modal-new-account", popup: true, persona: "Alex", path: "/finance/accounts", viewportOnly: true, run: async (p) => { await click("+ Add account")(p); await dialogOpen(p); } },
  { name: "modal-edit-account", popup: true, persona: "Alex", path: "/finance/accounts", viewportOnly: true, viewports: ["desktop"], run: async (p) => { await click("Edit", { exact: true })(p); await dialogOpen(p); } },
  { name: "form-vault-new", persona: "Alex", path: "/vault", viewportOnly: true, viewports: ["desktop"], run: async (p) => { await click("+ New entry")(p); await p.waitForTimeout(800); } },
  { name: "form-vault-edit", persona: "Alex", path: "/vault", viewportOnly: true, viewports: ["desktop"], run: async (p) => { await click("Edit Car registration")(p); await p.waitForTimeout(800); } },
  { name: "modal-mark-recurring", popup: true, persona: "Alex", path: "/finance/transactions", viewportOnly: true, viewports: ["desktop"], run: async (p) => { await p.getByRole("button", { name: /^Mark .* as recurring$/ }).first().click(); await dialogOpen(p); } },
  {
    name: "modal-payment-history",
    popup: true,
    persona: "Alex",
    path: "/finance/budgets",
    viewportOnly: true,
    run: async (p) => { await click(/^Payment history of Salary/)(p); await dialogOpen(p); },
  },
  {
    name: "select-open",
    popup: true,
    persona: "Alex",
    path: "/finance/transactions",
    viewportOnly: true,
    viewports: ["desktop"],
    run: async (p) => {
      await click("+ Transaction")(p);
      await dialogOpen(p);
      await p.getByRole("dialog").getByRole("combobox").first().click()  // the Account select;
      await p.getByRole("listbox").waitFor({ timeout: 5_000 });
    },
  },
  {
    name: "tooltip-recurring",
    persona: "Alex",
    path: "/finance/transactions",
    viewportOnly: true,
    viewports: ["desktop"],
    run: async (p) => {
      await p.getByRole("img", { name: /^Recurring/ }).first().waitFor({ timeout: 15_000 });
      await p.getByRole("button", { name: "Import CSV" }).focus();
      let reached = false;
      for (let i = 0; i < 200 && !reached; i++) {
        await p.keyboard.press("Tab");
        reached = await p.evaluate(() => (document.activeElement?.getAttribute("aria-label") ?? "").startsWith("Recurring"));
      }
      await p.getByText(/^Recurring · /).first().waitFor({ timeout: 5_000 });
    },
  },
  { name: "menu-assignee", popup: true, persona: "Alex", path: "/tasks", viewportOnly: true, viewports: ["desktop"], run: click("Assigned to Alex, click to change") },
  { name: "menu-priority", popup: true, persona: "Alex", path: "/tasks", viewportOnly: true, viewports: ["desktop"], run: click("Priority: High, click to change") },
  { name: "menu-reminder-schedule", popup: true, persona: "Alex", path: "/tasks", viewportOnly: true, viewports: ["desktop"], run: click("Every week, click to change") },
  { name: "confirm-delete-reminder", popup: true, persona: "Alex", path: "/tasks", viewportOnly: true, run: click("Delete Hoover the living room") },
  { name: "confirm-delete-list", popup: true, persona: "Alex", path: "/lists/shopping", viewportOnly: true, viewports: ["desktop"], run: click("Delete", { exact: true }) },
  { name: "color-picker", popup: true, persona: "Alex", path: "/settings/categories", viewportOnly: true, viewports: ["desktop"], run: click("Change colour of Dining") },
  { name: "budgets-edit-row", persona: "Alex", path: "/finance/budgets", viewportOnly: true, viewports: ["desktop"], run: async (p) => { await p.getByRole("tab", { name: "Household" }).click(); await p.getByRole("button", { name: "Edit Rent" }).click(); } },
  { name: "budgets-add-group", persona: "Alex", path: "/finance/budgets", viewportOnly: true, viewports: ["desktop"], run: async (p) => { await p.getByRole("tab", { name: "Household" }).click(); await clickText("+ Add group")(p); } },

  // ── Changes data: keep last ───────────────────────────────────────────────
  {
    name: "toast-reminder-done",
    persona: "Alex",
    path: "/tasks",
    viewportOnly: true,
    viewports: ["desktop"],
    run: async (p) => {
      await click("Mark Hoover the living room as done")(p);
      await p.getByRole("button", { name: "Undo" }).waitFor({ timeout: 20_000 });
    },
    cleanup: (page) => page.getByRole("button", { name: "Undo" }).click(),
  },
];

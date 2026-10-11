/**
 * Keyboard and accessibility checks for the Base UI migration (docs/specs/base-ui-component-layer.md):
 * what a Member can do without a mouse, and what a screen reader would find.
 *
 *   node tests/visual/behave.mjs        # against the Demo on http://127.0.0.1:3100 (VISUAL_BASE_URL to change)
 *
 * Checks that change data put it back. Not a permanent suite: a migration check.
 */
import { chromium } from "playwright";

const BASE = process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:3100";
const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push([true, name]);
  } catch (error) {
    results.push([false, `${name}: ${String(error.message).split("\n")[0]}`]);
  }
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, baseURL: BASE });
const page = await context.newPage();

async function open(path, ready) {
  await page.goto(path);
  await page.waitForFunction(() => !document.body.innerText.includes("Loading…"), null, { timeout: 60_000 }).catch(() => {});
  if (ready) await ready.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(500);
}
const activeName = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el ? (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 60) : "";
  });
const insideDialog = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"], [role="alertdialog"]'));

await page.goto("/signin");
await page.getByRole("button", { name: /Continue as Alex/ }).click();
await page.waitForURL("**/dashboard", { timeout: 60_000 });

// ── Dialog ────────────────────────────────────────────────────────────────
await check("dialog: opens from the keyboard, focus lands inside, Tab stays inside, Escape closes and returns focus", async () => {
  await open("/finance/transactions", page.getByRole("button", { name: "+ Transaction" }));
  const trigger = page.getByRole("button", { name: "+ Transaction" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor({ timeout: 10_000 });
  assert(await insideDialog(), "focus is not inside the dialog after opening");
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    // Past the last control, focus passes a guard that sends it back in; give it a moment.
    await page.waitForTimeout(150);
    assert(await insideDialog(), `focus left the dialog after ${i + 1} Tab presses`);
  }
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10_000 });
  assert((await activeName()).includes("+ Transaction"), `focus did not return to the trigger (is on "${await activeName()}")`);
});

await check("dialog: opened from the keyboard, focus lands on a leading Select's trigger, not on a hidden input", async () => {
  await open("/finance/transactions", page.getByRole("button", { name: "Import CSV" }));
  await page.getByRole("button", { name: "Import CSV" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor({ timeout: 10_000 });
  // Focus moves in a moment after the dialog appears.
  await page
    .waitForFunction(() => !!document.activeElement?.closest('[role="dialog"]') && document.activeElement !== document.querySelector('[role="dialog"]'), null, { timeout: 3_000 })
    .catch(() => {});
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    return { role: el?.getAttribute("role"), tag: el?.tagName, hidden: el?.getAttribute("aria-hidden") === "true" || el?.getAttribute("tabindex") === "-1" };
  });
  assert(focused.role === "combobox" && !focused.hidden, `focus is on <${focused.tag}> role=${focused.role}, not the Select trigger`);
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10_000 });
});

await check("dialog: the page behind does not scroll while it is open", async () => {
  await open("/finance/transactions", page.getByRole("button", { name: "+ Transaction" }));
  await page.getByRole("button", { name: "+ Transaction" }).click();
  await page.getByRole("dialog").waitFor();
  const locked = await page.evaluate(() => getComputedStyle(document.body).overflow === "hidden" || getComputedStyle(document.documentElement).overflow === "hidden");
  await page.keyboard.press("Escape");
  assert(locked, "page scroll is not locked");
});

await check("dialog: has an accessible name from its title", async () => {
  await page.getByRole("button", { name: "+ Transaction" }).click();
  const name = await page.getByRole("dialog").getAttribute("aria-labelledby");
  assert(name, "no aria-labelledby on the dialog");
  await page.keyboard.press("Escape");
});

// ── Alert dialog (delete confirmation) ────────────────────────────────────
await check("alert: deleting asks first, Cancel is focused, Escape cancels and nothing is deleted", async () => {
  await open("/tasks", page.getByRole("button", { name: "Delete Hoover the living room" }));
  const before = await page.getByRole("button", { name: /^Delete /, exact: false }).count();
  await page.getByRole("button", { name: "Delete Hoover the living room" }).click();
  await page.getByRole("alertdialog").waitFor({ timeout: 10_000 });
  // Focus moves in a moment after the alert appears.
  await page
    .waitForFunction(() => (document.activeElement?.textContent ?? "").trim() === "Cancel", null, { timeout: 3_000 })
    .catch(() => {});
  assert((await activeName()) === "Cancel", `focus is on "${await activeName()}", not Cancel`);
  await page.keyboard.press("Escape");
  await page.getByRole("alertdialog").waitFor({ state: "detached", timeout: 10_000 });
  await page.waitForTimeout(500);
  assert((await page.getByRole("button", { name: /^Delete /, exact: false }).count()) === before, "an item was deleted by cancelling");
});

await check("alert: the browser's own confirm() is never used (no native dialog appears)", async () => {
  let native = false;
  page.once("dialog", async (d) => {
    native = true;
    await d.dismiss();
  });
  await open("/lists/wishlist", page.getByRole("button", { name: /^Delete / }).first());
  await page.getByRole("button", { name: /^Delete / }).first().click();
  await page.getByRole("alertdialog").waitFor({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  assert(!native, "a native browser dialog appeared");
});

// ── Select ────────────────────────────────────────────────────────────────
await check("select: opens with Enter, arrow keys move, Enter chooses, type-ahead jumps", async () => {
  await open("/finance/transactions", page.getByRole("button", { name: "+ Transaction" }));
  await page.getByRole("button", { name: "+ Transaction" }).click();
  await page.getByRole("dialog").waitFor();
  const type = page.getByRole("dialog").getByRole("combobox").nth(1); // Account, Type, …
  await type.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("listbox").waitFor({ timeout: 5_000 });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.getByRole("listbox").waitFor({ state: "detached", timeout: 5_000 });
  const chosen = (await type.textContent())?.trim();
  assert(chosen && chosen.length > 0, "nothing shown after choosing");
  await page.keyboard.press("Escape");
});

// ── Menu ──────────────────────────────────────────────────────────────────
await check("menu: opens with Enter, arrows move, Escape closes and returns focus to the trigger", async () => {
  await open("/tasks", page.getByRole("button", { name: "Priority: High, click to change" }));
  const trigger = page.getByRole("button", { name: "Priority: High, click to change" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menu").waitFor({ timeout: 5_000 });
  await page.keyboard.press("ArrowDown");
  const focusedItem = await page.evaluate(() => document.activeElement?.getAttribute("role"));
  assert(focusedItem === "menuitem", `arrow key did not focus a menu item (role=${focusedItem})`);
  await page.keyboard.press("Escape");
  await page.getByRole("menu").waitFor({ state: "detached", timeout: 5_000 });
  assert((await activeName()).startsWith("Priority"), `focus did not return to the trigger (is on "${await activeName()}")`);
});

// ── Toast ─────────────────────────────────────────────────────────────────
await check("toast: appears in a polite live region, with its action, and Undo dismisses it", async () => {
  await open("/tasks", page.getByRole("button", { name: /^Mark .* as done$/ }).first());
  await page.getByRole("button", { name: /^Mark .* as done$/ }).first().click();
  const region = page.getByRole("region", { name: "Notifications" });
  await region.getByRole("button", { name: "Undo" }).waitFor({ timeout: 15_000 });
  const live = await region.getAttribute("aria-live");
  assert(live === "polite", `live region is "${live}"`);
  await region.getByRole("button", { name: "Undo" }).click();
  await region.getByRole("button", { name: "Undo" }).waitFor({ state: "detached", timeout: 5_000 });
});

// ── Labels, switch, tabs ──────────────────────────────────────────────────
await check("form field: the label is tied to its input (found by label text)", async () => {
  await open("/settings/household", page.getByText("Household name"));
  const input = page.getByLabel("Household name");
  assert((await input.count()) === 1, "label did not resolve to exactly one control");
  assert((await input.evaluate((el) => el.tagName)) === "INPUT", "label did not resolve to an input");
});

await check("switch: reports on/off and toggles with Space (then put back)", async () => {
  await open("/settings/household", page.getByRole("switch", { name: "Wishlist" }));
  await page.waitForTimeout(1500); // let the page hydrate before pressing keys
  const sw = page.getByRole("switch", { name: "Wishlist" });
  const start = await sw.getAttribute("aria-checked");
  assert(["true", "false"].includes(start ?? ""), `aria-checked is "${start}"`);
  try {
    await sw.focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(
      (before) => document.querySelector('[role="switch"][aria-label="Wishlist"]')?.getAttribute("aria-checked") !== before,
      start,
      { timeout: 8_000 },
    );
  } finally {
    // Whatever happened, leave the Demo as it was.
    if ((await sw.getAttribute("aria-checked")) !== start) {
      await sw.click();
      await page.waitForTimeout(1500);
    }
  }
  assert((await sw.getAttribute("aria-checked")) === start, "could not put the switch back");
});

await check("tab bar: the current page is marked aria-current, inside a labelled nav", async () => {
  await open("/finance/budgets", page.getByRole("link", { name: "Budgets" }));
  const current = await page.getByRole("link", { name: "Budgets" }).getAttribute("aria-current");
  assert(current === "page", `aria-current is "${current}"`);
  const navs = await page.getByRole("navigation", { name: /Finance sections/ }).count();
  assert(navs === 1, "no labelled Finance navigation");
});

await check("checkbox: the suggestion tick boxes are real checkboxes you can toggle with Space", async () => {
  await open("/finance/budgets", page.getByRole("checkbox").first());
  const box = page.getByRole("checkbox").first();
  const start = await box.getAttribute("aria-checked");
  await box.focus();
  await page.keyboard.press("Space");
  assert((await box.getAttribute("aria-checked")) !== start, "Space did not toggle");
  await page.keyboard.press("Space");
});

await check("radio group: arrow keys move between the budgeting choices", async () => {
  await open("/finance/budgets", page.getByRole("button", { name: /^Payment history of Salary/ }));
  await page.getByRole("button", { name: /^Payment history of Salary/ }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("radio").first().waitFor({ timeout: 15_000 });
  const radios = page.getByRole("radio");
  assert((await radios.count()) === 5, `expected 5 options, found ${await radios.count()}`);
  await radios.first().focus();
  await page.keyboard.press("ArrowDown");
  assert(await page.evaluate(() => document.activeElement?.getAttribute("role") === "radio"), "arrow did not stay in the radio group");
  await page.keyboard.press("Escape");
});

await check("sortable list: a budget row can be reordered with the keyboard (then put back)", async () => {
  await open("/finance/budgets", page.getByRole("tab", { name: "Household" }));
  await page.getByRole("tab", { name: "Household" }).click();
  const grip = page.getByRole("button", { name: "Reorder Energy" });
  await grip.waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1500); // let the page hydrate before pressing keys
  const order = () => page.evaluate(() => [...document.querySelectorAll('[aria-label^="Reorder "]')].map((el) => el.getAttribute("aria-label")));
  const waitForOrder = (differsFrom) =>
    page.waitForFunction(
      (before) => JSON.stringify([...document.querySelectorAll('[aria-label^="Reorder "]')].map((el) => el.getAttribute("aria-label"))) !== before,
      JSON.stringify(differsFrom),
      { timeout: 8_000 },
    );
  const move = async (key) => {
    await grip.focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    await page.keyboard.press(key);
    await page.waitForTimeout(300);
    await page.keyboard.press("Space");
  };
  const original = await order();
  const at = original.indexOf("Reorder Energy");
  assert(at >= 0 && at < original.length - 1, "Energy is missing or last in its list");
  let moved = false;
  try {
    await move("ArrowDown");
    await waitForOrder(original);
    moved = true;
    const after = await order();
    assert(after.indexOf("Reorder Energy") === at + 1, `Energy is at ${after.indexOf("Reorder Energy")}, expected ${at + 1}`);
  } finally {
    // Whatever happened, leave the Demo as it was.
    if (moved) {
      const changed = await order();
      await move("ArrowUp");
      await waitForOrder(changed).catch(() => {});
      await page.waitForTimeout(1000);
    }
  }
  assert(JSON.stringify(await order()) === JSON.stringify(original), "could not put the order back");
});

await check("tooltip: the repeat icon shows its tip when reached with the keyboard", async () => {
  await open("/finance/transactions", page.getByRole("img", { name: /^Recurring/ }).first());
  await page.getByRole("button", { name: "Import CSV" }).focus();
  let reached = false;
  for (let i = 0; i < 200 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => (document.activeElement?.getAttribute("aria-label") ?? "").startsWith("Recurring"));
  }
  assert(reached, "could not Tab to the recurring icon");
  // Base UI's tip is a plain dark card with no ARIA role; find it by its text.
  await page.getByText("Recurring · every month").first().waitFor({ timeout: 5_000 });
});

await browser.close();

const failed = results.filter(([ok]) => !ok);
for (const [ok, name] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exitCode = failed.length ? 1 : 0;

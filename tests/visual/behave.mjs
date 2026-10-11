/**
 * Behaviour checks, run in a browser against the Demo:
 *  - keyboard and accessibility checks for the Base UI migration (docs/specs/base-ui-component-layer.md): what a
 *    Member can do without a mouse, and what a screen reader would find;
 *  - checks for optimistic updates (docs/specs/optimistic-updates.md): every API call is delayed by about 800 ms and
 *    the screen must already show the change, a call is made to fail on purpose and the change must be undone with
 *    "Couldn't save, change undone", quick sequences must reach the server in order, and the changes the server has
 *    to work out must still wait.
 *
 *   node tests/visual/behave.mjs                     # against the Demo on http://127.0.0.1:3100 (VISUAL_BASE_URL to change)
 *   BEHAVE_ONLY=optimistic node tests/visual/behave.mjs   # only the checks whose name contains the text
 *
 * Checks that change data put it back. Not a permanent suite: a migration check.
 */
import { chromium } from "playwright";

const BASE = process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:3100";
const results = [];
const only = process.env.BEHAVE_ONLY;
const check = async (name, fn) => {
  if (only && !name.includes(only)) return;
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
// A service worker (push notifications) would answer API calls before the test can delay or fail them.
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, baseURL: BASE, serviceWorkers: "block" });
const page = await context.newPage();

async function open(path, ready) {
  await page.goto(path);
  await page.waitForFunction(() => !document.body.innerText.includes("Loading…"), null, { timeout: 60_000 }).catch(() => {});
  if (ready) await ready.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(500);
}

// ── Optimistic updates: the test seam ─────────────────────────────────────
// What the Member sees. Every API call can be delayed (SLOW_MS) so a screen that already shows a change could not
// have waited for the server; a call can be made to fail; and `settle` waits until everything has been saved.
const SLOW_MS = 800;
/** "Within a fraction of a second": well under SLOW_MS, so the server cannot have answered yet. */
const AT_ONCE = 500;
let inFlight = 0;
let lastTraffic = 0;
page.on("request", (r) => r.url().includes("/api/trpc/") && (inFlight++, (lastTraffic = Date.now())));
page.on("requestfinished", (r) => r.url().includes("/api/trpc/") && (inFlight--, (lastTraffic = Date.now())));
page.on("requestfailed", (r) => r.url().includes("/api/trpc/") && (inFlight--, (lastTraffic = Date.now())));

async function slowly(run) {
  const delay = async (route) => {
    await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
    await route.continue().catch(() => {});
  };
  await page.route("**/api/trpc/**", delay);
  try {
    return await run();
  } finally {
    await settle();
    await page.unroute("**/api/trpc/**", delay);
  }
}
/** Makes every call to these procedures fail (the network drops it) while `run` goes on; the rest are delayed as in `slowly`. */
async function failing(procedures, run) {
  const handler = async (route) => {
    // A refused call takes as long to refuse as an accepted one takes to accept.
    await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
    if (procedures.some((name) => route.request().url().includes(`/api/trpc/${name}`))) return route.abort("failed").catch(() => {});
    await route.continue().catch(() => {});
  };
  await page.route("**/api/trpc/**", handler);
  try {
    return await run();
  } finally {
    await settle();
    await page.unroute("**/api/trpc/**", handler);
  }
}
/** Waits until nothing has been sent to the API for a moment and nothing is in flight: everything is saved. */
async function settle() {
  const until = Date.now() + 30_000;
  while (Date.now() < until && (inFlight > 0 || Date.now() - lastTraffic < 900)) await page.waitForTimeout(100);
}
const notifications = () => page.getByRole("region", { name: "Notifications" });
async function expectUndone() {
  await notifications().getByText("Couldn't save, change undone").waitFor({ timeout: 8_000 });
}
async function expectNoUndone() {
  assert((await notifications().getByText("Couldn't save, change undone").count()) === 0, "a change was undone with an error message");
}
async function within(ms, what, promise) {
  const started = Date.now();
  await promise;
  const took = Date.now() - started;
  assert(took < ms, `${what} took ${took} ms (limit ${ms} ms)`);
}
/** Calls the API as the signed-in Member, to look at the saved state or put something back. */
async function api(procedure, input, { write = false } = {}) {
  // The Demo's database now and then times out under load; a read or a put-back is worth another try.
  for (let attempt = 1; ; attempt++) {
    try {
      return await apiOnce(procedure, input, write);
    } catch (error) {
      if (attempt >= 4) throw error;
      await page.waitForTimeout(2_000 * attempt);
    }
  }
}
async function apiOnce(procedure, input, write) {
  const body = input === undefined ? { json: null, meta: { values: ["undefined"] } } : { json: input };
  const response = write
    ? await context.request.post(`/api/trpc/${procedure}?batch=1`, { data: { 0: body } })
    : await context.request.get(`/api/trpc/${procedure}?batch=1&input=${encodeURIComponent(JSON.stringify({ 0: body }))}`);
  const parsed = await response.json();
  if (!response.ok() || parsed[0]?.error) throw new Error(`${procedure} failed: ${JSON.stringify(parsed[0]?.error?.json?.message ?? response.status())}`);
  return parsed[0].result.data.json;
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


// ── Optimistic updates ────────────────────────────────────────────────────
// Each check delays every API call by ~800 ms and asserts the screen changed within AT_ONCE, then waits for the
// saves to finish and looks at what was kept. Whatever was created is removed again through the API.

await check("optimistic tasks: a new todo shows at once, ticking it straight away reaches the server in order, and a reload agrees", async () => {
  const title = "Behave todo";
  const leftovers = async () => {
    for (const task of await api("task.list", undefined)) if (task.title === title) await api("task.delete", { id: task.id }, { write: true });
  };
  await leftovers();
  try {
    await open("/tasks", page.getByRole("button", { name: "New todo" }));
    const completedBefore = Number(((await page.getByRole("button", { name: /^Completed/ }).textContent()) ?? "").match(/\d+/)?.[0] ?? 0);
    await slowly(async () => {
      await page.getByRole("button", { name: "New todo" }).click();
      const input = page.getByRole("textbox", { name: "New todo" });
      await input.fill(title);
      await input.press("Enter");
      const tick = page.locator("div.group", { has: page.getByRole("button", { name: `Delete ${title}` }) }).getByRole("button", { name: "Mark as done" });
      await within(AT_ONCE, "the new todo appearing", tick.waitFor());
      await tick.click();
      // It moves under "Completed" at once, before the add has even reached the server.
      await within(AT_ONCE, "the todo being ticked", page.getByRole("button", { name: `Completed · ${completedBefore + 1}` }).waitFor());
    });
    await expectNoUndone();
    await page.reload();
    await page.getByRole("button", { name: `Completed · ${completedBefore + 1}` }).waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Completed/ }).click();
    await page.getByRole("button", { name: `Delete ${title}` }).waitFor({ timeout: 5_000 });
  } finally {
    await leftovers();
  }
});

await check("optimistic tasks: a change the server refuses is undone, with \"Couldn't save, change undone\" announced", async () => {
  await open("/tasks", page.getByRole("button", { name: "Mark as done", exact: true }).first());
  const completed = async () => Number(((await page.getByRole("button", { name: /^Completed/ }).textContent()) ?? "").match(/\d+/)?.[0] ?? 0);
  const before = await completed();
  const openBefore = await page.getByRole("button", { name: "Mark as done", exact: true }).count();
  await failing(["task.toggleComplete"], async () => {
    await page.getByRole("button", { name: "Mark as done", exact: true }).first().click();
    await within(AT_ONCE, "the todo being ticked", page.getByRole("button", { name: `Completed · ${before + 1}` }).waitFor());
    await expectUndone();
    // Back to how it was.
    await page.getByRole("button", { name: `Completed · ${before}` }).waitFor({ timeout: 5_000 });
  });
  assert((await page.getByRole("button", { name: "Mark as done", exact: true }).count()) === openBefore, "the todo did not come back");
  const live = await notifications().getAttribute("aria-live");
  assert(live === "polite", `the message is not in a polite live region ("${live}")`);
});

await check("optimistic shopping: a new list is selected at once and takes items straight away, ticking and favourites are instant, and a reload agrees", async () => {
  const name = "Behave list";
  const leftovers = async () => {
    for (const list of await api("shopping.lists", undefined)) if (list.name === name) await api("shopping.deleteList", { id: list.id }, { write: true });
  };
  await leftovers();
  try {
    await open("/lists/shopping", page.getByRole("button", { name: "+ New list" }));
    await slowly(async () => {
      await page.getByRole("button", { name: "+ New list" }).click();
      await page.getByRole("textbox", { name: "List name" }).fill(name);
      await page.getByRole("button", { name: "Create", exact: true }).click();
      const chip = page.getByRole("button", { name: new RegExp(`^${name}`) });
      await within(AT_ONCE, "the new list appearing", chip.waitFor());
      assert((await chip.getAttribute("aria-pressed")) === "true", "the new list is not selected");
      await page.getByRole("button", { name: "Add item" }).click();
      const item = page.getByRole("textbox", { name: "Item" });
      for (const text of ["Behave milk", "Behave eggs"]) {
        await item.fill(text);
        await item.press("Enter");
        await within(AT_ONCE, `${text} appearing`, page.getByRole("button", { name: `Tick off ${text}` }).waitFor());
      }
      await page.getByRole("button", { name: "Add Behave milk to favorites" }).click();
      await within(AT_ONCE, "the favourite appearing", page.getByRole("button", { name: "Remove Behave milk from favorites" }).first().waitFor());
      await page.getByRole("button", { name: "Tick off Behave eggs" }).click();
      await within(AT_ONCE, "the tick showing", page.getByRole("button", { name: "Put Behave eggs back on the list" }).waitFor());
      assert((await chip.textContent())?.includes("1"), "the open count on the list button did not follow the tick");
    });
    await expectNoUndone();
    await page.reload();
    const chip = page.getByRole("button", { name: new RegExp(`^${name}`) });
    await chip.waitFor({ timeout: 30_000 });
    await chip.click();
    await page.getByRole("button", { name: "Tick off Behave milk" }).waitFor({ timeout: 10_000 });
    assert((await page.getByRole("button", { name: "Tick off Behave eggs" }).count()) === 0, "the ticked item is still open after a reload");
  } finally {
    await leftovers();
  }
});

await check("optimistic shopping: deleting a list (confirmed in the alert) removes it at once and selects the next; if refused it comes back selected", async () => {
  const name = "Behave doomed list";
  const leftovers = async () => {
    for (const list of await api("shopping.lists", undefined)) if (list.name === name) await api("shopping.deleteList", { id: list.id }, { write: true });
  };
  await leftovers();
  try {
    await open("/lists/shopping", page.getByRole("button", { name: "+ New list" }));
    await page.getByRole("button", { name: "+ New list" }).click();
    await page.getByRole("textbox", { name: "List name" }).fill(name);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    const chip = page.getByRole("button", { name: new RegExp(`^${name}`) });
    await chip.waitFor({ timeout: 15_000 });
    await settle();
    const remove = async () => {
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete list" }).click();
    };
    // Refused: it vanishes, then returns, selected again, with the message.
    await failing(["shopping.deleteList"], async () => {
      await remove();
      await within(AT_ONCE, "the list vanishing", chip.waitFor({ state: "detached" }));
      assert((await page.locator('[role="group"][aria-label="Shopping lists"] [aria-pressed="true"]').count()) === 1, "no other list was selected after the delete");
      await expectUndone();
      await chip.waitFor({ timeout: 8_000 });
      assert((await chip.getAttribute("aria-pressed")) === "true", "the returned list is not selected again");
    });
    // Accepted: gone, and stays gone.
    await slowly(async () => {
      await remove();
      await within(AT_ONCE, "the list vanishing", chip.waitFor({ state: "detached" }));
    });
    await expectNoUndone();
    await page.reload();
    await page.getByRole("button", { name: "+ New list" }).waitFor({ timeout: 30_000 });
    assert((await page.getByRole("button", { name: new RegExp(`^${name}`) }).count()) === 0, "the deleted list is back after a reload");
  } finally {
    await leftovers();
  }
});

await check("optimistic reminders: ticking one shows the new state and the Undo toast at once, and Undo puts the due date back", async () => {
  const title = "Water the plants";
  const due = async () => (await api("reminder.list", undefined)).find((r) => r.title === title).nextDueDate;
  await open("/tasks", page.getByRole("button", { name: `Mark ${title} as done` }));
  const before = await due();
  await slowly(async () => {
    await page.getByRole("button", { name: `Mark ${title} as done` }).click();
    // (In development React mounts the toast twice and the first copy is still fading out: the live one is the last.)
    const undo = notifications().getByRole("button", { name: "Undo" }).last();
    await within(AT_ONCE, "the Undo toast", undo.waitFor());
    // Due today before; three days on afterwards, so no longer under "Due today".
    await within(AT_ONCE, "the reminder moving on", page.getByText(`✓ ${title} done`).waitFor());
    await undo.click();
    await notifications().getByRole("button", { name: "Undo" }).first().waitFor({ state: "detached", timeout: 10_000 });
  });
  await expectNoUndone();
  assert(String(await due()) === String(before), "the due date was not put back");
});

await check("optimistic transactions: a new transaction, a category change and a delete each show at once", async () => {
  const merchant = "Behave coffee";
  const leftovers = async () => {
    for (const t of await api("transaction.list", { limit: 100 })) if (t.merchant === merchant) await api("transaction.delete", { id: t.id }, { write: true });
  };
  await leftovers();
  try {
    await open("/finance/transactions", page.getByRole("button", { name: "+ Transaction" }));
    const row = page.locator("div.group", { hasText: merchant });
    await slowly(async () => {
      await page.getByRole("button", { name: "+ Transaction" }).click();
      await page.getByRole("dialog").getByLabel("Description").fill(merchant);
      await page.getByRole("dialog").getByLabel("Amount (€)").fill("3.50");
      await page.getByRole("button", { name: "Add transaction" }).click();
      await within(AT_ONCE, "the new transaction appearing", row.waitFor());
      assert((await page.getByRole("dialog").count()) === 0, "the form stayed open");
      // A category, at once.
      await row.getByRole("combobox", { name: "Category" }).click();
      const option = page.getByRole("option").nth(1);
      const chosen = ((await option.textContent()) ?? "").trim();
      await option.click();
      await within(AT_ONCE, "the category showing", page.waitForFunction(([text, name]) => [...document.querySelectorAll("div.group")].some((d) => d.textContent.includes(text) && d.querySelector('[aria-label="Category"]')?.textContent.includes(name)), [merchant, chosen]));
      // And a delete, confirmed in the alert.
      await row.getByRole("button", { name: "✕" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
      await within(AT_ONCE, "the transaction vanishing", row.waitFor({ state: "detached" }));
    });
    await expectNoUndone();
    await page.reload();
    await page.getByRole("button", { name: "+ Transaction" }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1000);
    assert((await row.count()) === 0, "the deleted transaction is back after a reload");
  } finally {
    await leftovers();
  }
});

await check("optimistic accounts: renaming shows at once; a new account waits for the server, then deleting it shows at once", async () => {
  const original = "Shared · Credit card";
  const renamed = "Behave card";
  const created = "Behave account";
  const account = async (name) => (await api("account.list", undefined)).find((a) => a.name === name);
  const leftovers = async () => {
    const wrongName = await account(renamed);
    if (wrongName) await api("account.update", { id: wrongName.id, name: original }, { write: true });
    const extra = await account(created);
    if (extra) await api("account.delete", { id: extra.id }, { write: true });
  };
  await leftovers();
  try {
    await open("/finance/accounts", page.getByRole("link", { name: new RegExp(original) }));
    const rowOf = (name) => page.locator("div.rounded-xl", { has: page.getByRole("link", { name: new RegExp(name) }) });
    await slowly(async () => {
      await rowOf(original).getByRole("button", { name: "Edit" }).click();
      await page.getByRole("dialog").getByLabel("Account name").fill(renamed);
      await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
      await within(AT_ONCE, "the new name showing", page.getByRole("link", { name: new RegExp(renamed) }).waitFor());
      assert((await page.getByRole("dialog").count()) === 0, "the form stayed open");
    });
    await expectNoUndone();
    await api("account.update", { id: (await account(renamed)).id, name: original }, { write: true });
    // Creating works out values on the server: the form stays busy and nothing is guessed.
    await page.reload();
    await page.getByRole("button", { name: "+ Add account" }).waitFor({ timeout: 30_000 });
    await slowly(async () => {
      await page.getByRole("button", { name: "+ Add account" }).click();
      await page.getByRole("dialog").getByLabel("Account name").fill(created);
      await page.getByRole("dialog").getByLabel("Starting balance (€)").fill("1");
      await page.getByRole("button", { name: "Create account" }).click();
      await page.waitForTimeout(AT_ONCE - 100);
      assert((await page.getByRole("link", { name: new RegExp(created) }).count()) === 0, "the new account appeared before the server answered");
      assert(await page.getByRole("button", { name: "Create account" }).isDisabled(), "the form does not show that it is busy");
      await page.getByRole("link", { name: new RegExp(created) }).waitFor({ timeout: 10_000 });
      await rowOf(created).getByRole("button", { name: "Delete" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
      await within(AT_ONCE, "the account vanishing", page.getByRole("link", { name: new RegExp(created) }).waitFor({ state: "detached" }));
    });
    await expectNoUndone();
  } finally {
    await leftovers();
  }
});

await check("optimistic categories: adding, then deleting a category shows at once", async () => {
  const name = "Behave category";
  const leftovers = async () => {
    for (const c of await api("category.list", undefined)) if (c.name === name) await api("category.delete", { id: c.id }, { write: true });
  };
  await leftovers();
  try {
    await open("/settings/categories", page.getByPlaceholder("New category"));
    await page.getByRole("button", { name: "Delete", exact: true }).first().waitFor({ timeout: 30_000 }); // the list has loaded
    const index = () =>
      page.evaluate((n) => [...document.querySelectorAll("input")].filter((i) => i.className.includes("flex-1")).findIndex((i) => i.value === n), name);
    await slowly(async () => {
      await page.getByPlaceholder("New category").fill(name);
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await within(AT_ONCE, "the category appearing", page.waitForFunction((n) => [...document.querySelectorAll("input")].some((i) => i.value === n), name));
      await page.getByRole("button", { name: "Delete", exact: true }).nth(await index()).click();
      await within(AT_ONCE, "the category vanishing", page.waitForFunction((n) => ![...document.querySelectorAll("input")].some((i) => i.value === n), name));
    });
    await expectNoUndone();
  } finally {
    await leftovers();
  }
});

await check("optimistic budgets: a Budget group and a recurring expense show at once, and a new Budgeted amount replaces the old one at once (then put back)", async () => {
  const group = "Behave group";
  const sub = "Behave subscription";
  const leftovers = async () => {
    for (const g of await api("budgetGroup.list", undefined)) if (g.name === group) await api("budgetGroup.delete", { id: g.id }, { write: true });
    for (const i of await api("recurring.list", undefined)) if (i.name === sub) await api("recurring.delete", { id: i.id }, { write: true });
  };
  await leftovers();
  const internet = (await api("recurring.list", undefined)).find((i) => i.name === "Internet");
  try {
    await open("/finance/budgets", page.getByRole("button", { name: "+ Add group" }).first());
    await page.getByRole("button", { name: /^Group name: / }).first().waitFor({ timeout: 30_000 }); // the groups have loaded
    await slowly(async () => {
      await page.getByRole("button", { name: "+ Add group" }).first().click();
      await page.getByRole("textbox", { name: "New group name" }).fill(group);
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await within(AT_ONCE, "the group appearing", page.getByRole("button", { name: `Group name: ${group}, click to change` }).waitFor());
      await page.getByRole("button", { name: `Delete group ${group}` }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
      await within(AT_ONCE, "the group vanishing", page.getByRole("button", { name: `Delete group ${group}` }).waitFor({ state: "detached" }));
      // A recurring expense.
      await page.getByRole("button", { name: "Add expense" }).click();
      await page.getByPlaceholder("Name", { exact: true }).fill(sub);
      await page.getByPlaceholder("0.00").fill("5");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await within(AT_ONCE, "the expense appearing", page.getByRole("button", { name: `Delete ${sub}` }).waitFor());
      await page.getByRole("button", { name: `Delete ${sub}` }).click();
      await within(AT_ONCE, "the expense vanishing", page.getByRole("button", { name: `Delete ${sub}` }).waitFor({ state: "detached" }));
    });
    await expectNoUndone();
    // The Budgeted amount of a shared item.
    await page.getByRole("tab", { name: "Household" }).click();
    const amount = page.getByRole("button", { name: "Amount: 49.95, click to change" });
    await amount.waitFor({ timeout: 15_000 });
    await slowly(async () => {
      await amount.click();
      const input = page.getByRole("textbox", { name: "Amount" });
      await input.fill("50");
      await input.press("Enter");
      await within(AT_ONCE, "the new amount showing", page.getByRole("button", { name: "Amount: 50, click to change" }).waitFor());
    });
    await expectNoUndone();
  } finally {
    await api("recurring.update", { id: internet.id, amount: internet.amount }, { write: true });
    await leftovers();
  }
});

await check("optimistic wishlist: adding and deleting a wish shows at once", async () => {
  const title = "Behave wish";
  const me = await api("user.me", undefined);
  const leftovers = async () => {
    for (const w of await api("wishlist.list", { ownerId: me.id })) if (w.title === title) await api("wishlist.delete", { id: w.id }, { write: true });
  };
  await leftovers();
  try {
    await open("/lists/wishlist", page.getByRole("button", { name: "Add wish" }));
    await slowly(async () => {
      await page.getByRole("button", { name: "Add wish" }).click();
      await page.getByRole("textbox", { name: "Wish" }).fill(title);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await within(AT_ONCE, "the wish appearing", page.getByRole("button", { name: `Delete ${title}` }).waitFor());
      await page.getByRole("button", { name: `Delete ${title}` }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
      await within(AT_ONCE, "the wish vanishing", page.getByRole("button", { name: `Delete ${title}` }).waitFor({ state: "detached" }));
    });
    await expectNoUndone();
  } finally {
    await leftovers();
  }
});

await check("optimistic vault: a new entry shows at once; revealing a secret still waits for the server and shows nothing before", async () => {
  const title = "Behave vault entry";
  const leftovers = async () => {
    for (const e of await api("vault.list", undefined)) if (e.title === title) await api("vault.delete", { id: e.id }, { write: true });
  };
  await leftovers();
  try {
    await open("/vault", page.getByRole("button", { name: "+ New entry" }));
    await slowly(async () => {
      await page.getByRole("button", { name: "+ New entry" }).click();
      await page.locator('input[name="title"]').fill(title);
      await page.getByRole("button", { name: "Add to Vault" }).click();
      await within(AT_ONCE, "the entry appearing", page.getByRole("button", { name: `Delete ${title}` }).waitFor());
      await page.getByRole("button", { name: `Delete ${title}` }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
      await within(AT_ONCE, "the entry vanishing", page.getByRole("button", { name: `Delete ${title}` }).waitFor({ state: "detached" }));
      // Revealing is worked out by the server: busy, no value, no Hide until it answers.
      const reveal = page.getByRole("button", { name: "Reveal" }).first();
      await reveal.click();
      await page.waitForTimeout(AT_ONCE - 100);
      assert((await page.getByRole("button", { name: "Hide", exact: true }).count()) === 0, "a secret was shown before the server answered");
      assert(await reveal.isDisabled(), "the Reveal button does not show that it is busy");
      await page.getByRole("button", { name: "Hide", exact: true }).first().waitFor({ timeout: 10_000 });
      await page.getByRole("button", { name: "Hide", exact: true }).first().click();
    });
    await expectNoUndone();
  } finally {
    await leftovers();
  }
});

await check("optimistic household settings: switching a Module off removes it from the navigation at once (then back on); a new name shows at once (then put back)", async () => {
  await open("/settings/household", page.getByRole("switch", { name: "Vault" }));
  await page.waitForTimeout(1500);
  const original = (await api("household.current", undefined)).name;
  const links = () => page.locator('nav a[href="/vault"]').count();
  assert((await links()) > 0, "the Vault is not in the navigation to begin with");
  try {
    await slowly(async () => {
      await page.getByRole("switch", { name: "Vault" }).click();
      await within(AT_ONCE, "the navigation changing", page.waitForFunction(() => document.querySelectorAll('nav a[href="/vault"]').length === 0));
      assert((await page.getByRole("switch", { name: "Vault" }).getAttribute("aria-checked")) === "false", "the switch did not flip");
      await page.getByRole("switch", { name: "Vault" }).click();
      await within(AT_ONCE, "the navigation coming back", page.waitForFunction(() => document.querySelectorAll('nav a[href="/vault"]').length > 0));
      await page.getByLabel("Household name").fill("Behave household");
      await page.getByRole("button", { name: "Update" }).click();
      await within(AT_ONCE, "the name being accepted", page.waitForFunction(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Update")?.disabled === true));
    });
    await expectNoUndone();
    assert((await api("household.current", undefined)).name === "Behave household", "the new name was not saved");
  } finally {
    await api("household.rename", { name: original }, { write: true });
    const current = await api("household.current", undefined);
    if (current.disabledModules.includes("vault")) await api("household.setModuleEnabled", { key: "vault", enabled: true }, { write: true });
  }
});

await check("optimistic profile: a new name shows at once (then put back)", async () => {
  await open("/settings/profile", page.getByLabel("Name", { exact: true }));
  const original = (await api("user.me", undefined)).name;
  try {
    await slowly(async () => {
      await page.getByLabel("Name", { exact: true }).fill("Alex Behave");
      await page.getByRole("button", { name: "Update" }).first().click();
      await within(AT_ONCE, "the name being accepted", page.waitForFunction(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Update")?.disabled === true));
    });
    await expectNoUndone();
    assert((await api("user.me", undefined)).name === "Alex Behave", "the new name was not saved");
  } finally {
    await api("user.updateName", { name: original }, { write: true });
  }
});

await browser.close();

const failed = results.filter(([ok]) => !ok);
for (const [ok, name] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exitCode = failed.length ? 1 : 0;

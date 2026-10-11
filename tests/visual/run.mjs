/**
 * Before/after check for the Base UI migration (docs/specs/base-ui-component-layer.md).
 *
 *   npm run demo:reset && npm run demo:dev        # the Demo on http://127.0.0.1:3100
 *   node tests/visual/run.mjs capture before      # screenshots every scenario into .visual/before
 *   node tests/visual/run.mjs capture before --only vault   # (re)capture just the scenarios whose name contains "vault"
 *   ... migrate ...
 *   node tests/visual/run.mjs capture after
 *   node tests/visual/run.mjs compare before after
 *
 * Reset the Demo once (npm run demo:reset) before the FIRST capture, then do not reset again: resetting reshuffles
 * items that tie on a date and would show up as false differences. Scenarios that change data undo themselves.
 * The Demo's dates are relative to today, so compare captures made on the same day.
 * This is a migration check, not a permanent regression suite.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

import { SCENARIOS, VIEWPORTS } from "./scenarios.mjs";

const BASE = process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:3100";
const OUT = path.resolve(".visual");
const POPUP = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

const FREEZE = `
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; scroll-behavior: auto !important; }
  nextjs-portal { display: none !important; }
`;

async function signIn(browser, persona, viewport) {
  const context = await browser.newContext({ viewport, baseURL: BASE });
  const page = await context.newPage();
  await page.goto("/signin");
  await page.getByRole("button", { name: new RegExp(`Continue as ${persona}`, "i") }).click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
  await page.close();
  return context;
}

async function settle(page) {
  await page.addStyleTag({ content: FREEZE });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForFunction(() => !document.body.innerText.includes("Loading…"), null, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function capture(label, only) {
  const dir = path.join(OUT, label);
  // A full capture starts clean; an --only capture adds to (or replaces files in) an existing one.
  if (!only) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const contexts = new Map();
  const failures = [];
  let taken = 0;

  for (const scenario of SCENARIOS) {
    if (only && !scenario.name.includes(only)) continue;
    for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
      if (scenario.viewports && !scenario.viewports.includes(vpName)) continue;
      const key = `${scenario.persona ?? "none"}@${vpName}`;
      try {
        if (!contexts.has(key)) {
          contexts.set(
            key,
            scenario.persona
              ? await signIn(browser, scenario.persona, viewport)
              : await browser.newContext({ viewport, baseURL: BASE }),
          );
        }
        const page = await contexts.get(key).newPage();
        await page.goto(scenario.path);
        await settle(page);
        if (scenario.mask) {
          await page.addStyleTag({ content: scenario.mask.map((s) => `${s}{visibility:hidden!important}`).join("\n") });
        }
        if (scenario.run) {
          await scenario.run(page, vpName);
          await settle(page);
          if (scenario.mask) await page.addStyleTag({ content: scenario.mask.map((s) => `${s}{visibility:hidden!important}`).join("\n") });
        }
        await page.screenshot({ path: path.join(dir, `${scenario.name}@${vpName}.png`), fullPage: !scenario.viewportOnly });
        taken++;
        // Pop-ups, menus and dialogs are also captured on their own: the list behind them can come back in a
        // different order between page loads, which has nothing to do with the pop-up.
        if (scenario.popup) {
          const popup = page.locator(POPUP).last();
          if (await popup.count()) await popup.screenshot({ path: path.join(dir, `${scenario.name}@${vpName}.popup.png`) });
        }
        // A scenario that changed data puts it back, so captures can follow each other without a reset.
        if (scenario.cleanup) {
          await scenario.cleanup(page);
          await page.waitForTimeout(1200);
        }
        await page.close();
      } catch (error) {
        failures.push(`${scenario.name}@${vpName}: ${String(error.message).split("\n")[0]}`);
      }
    }
  }
  await browser.close();
  console.log(`captured ${taken} screenshots into ${path.relative(".", dir)}`);
  if (failures.length) {
    console.log(`\n${failures.length} scenario(s) failed:`);
    for (const f of failures) console.log("  - " + f);
  }
}

function compare(before, after) {
  const a = path.join(OUT, before);
  const b = path.join(OUT, after);
  const diffDir = path.join(OUT, `diff-${before}-${after}`);
  fs.rmSync(diffDir, { recursive: true, force: true });
  fs.mkdirSync(diffDir, { recursive: true });
  const names = fs.readdirSync(a).filter((f) => f.endsWith(".png")).sort();
  const rows = [];
  for (const name of names) {
    const fileB = path.join(b, name);
    if (!fs.existsSync(fileB)) {
      rows.push({ name, note: "missing in after" });
      continue;
    }
    const imgA = PNG.sync.read(fs.readFileSync(path.join(a, name)));
    const imgB = PNG.sync.read(fs.readFileSync(fileB));
    if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
      // A pop-up crop of the old code is its full-screen overlay, of the new code the card itself: not comparable.
      // The full-page screenshot of the same scenario is the real test.
      rows.push({
        name,
        note: `size ${imgA.width}x${imgA.height} -> ${imgB.width}x${imgB.height}`,
        informational: name.includes(".popup."),
      });
      continue;
    }
    const diff = new PNG({ width: imgA.width, height: imgA.height });
    const changed = pixelmatch(imgA.data, imgB.data, diff.data, imgA.width, imgA.height, { threshold: 0.12, includeAA: false });
    const pct = (changed / (imgA.width * imgA.height)) * 100;
    if (changed > 0) fs.writeFileSync(path.join(diffDir, name), PNG.sync.write(diff));
    rows.push({ name, changed, pct });
  }
  for (const name of fs.readdirSync(b).filter((f) => f.endsWith(".png"))) {
    if (!names.includes(name)) rows.push({ name, note: "new in after" });
  }
  const isBad = (r) => (r.note && !r.informational) || r.pct > 0.02;
  const bad = rows.filter(isBad);
  for (const r of rows) {
    const flag = isBad(r) ? "DIFF" : r.informational ? "info" : "ok  ";
    console.log(`${flag} ${r.name.padEnd(46)} ${r.note ?? `${r.changed} px (${r.pct.toFixed(3)}%)`}`);
  }
  console.log(`\n${rows.length - bad.length}/${rows.length} identical (≤0.02% of pixels). Diffs: ${path.relative(".", diffDir)}`);
}

const [command, ...args] = process.argv.slice(2);
const onlyAt = args.indexOf("--only");
if (command === "capture") await capture(args[0] ?? "after", onlyAt >= 0 ? args[onlyAt + 1] : undefined);
else if (command === "compare") compare(args[0] ?? "before", args[1] ?? "after");
else console.log("usage: node tests/visual/run.mjs capture <label> | compare <before> <after>");

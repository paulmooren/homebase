/**
 * Auth smoke test: sign up, confirm the email, sign out, signed-out redirect, wrong password, sign in,
 * forgot password and reset.
 *
 *   npm run dev                      # http://localhost:3000, pointed at a dev database, RESEND_API_KEY unset
 *   set -a && . ./.env && set +a && node tests/auth/smoke.mjs
 *
 * Emails aren't sent in dev: the app appends them to .email-outbox.jsonl, which this test reads to follow the
 * confirmation and reset links. Creates one throwaway user (@auth-smoke.test) and deletes it afterwards.
 * Refuses to run against anything but localhost. Google sign-in can't be automated and is checked by hand.
 * On the Demo, check "Continue as Alex" by hand.
 */
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.AUTH_SMOKE_URL ?? "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(BASE).hostname)) {
  console.error(`Refusing to run against ${BASE}: the smoke test creates a user.`);
  process.exit(1);
}

const email = `smoke-${Date.now()}@auth-smoke.test`;
const password = "smoke-test-pass-1";
const newPassword = "smoke-test-pass-2";
const prisma = new PrismaClient();
const browser = await chromium.launch();
const page = await (await browser.newContext({ baseURL: BASE })).newPage();

let failed = false;
async function step(name, fn) {
  try {
    await fn();
    console.log(`OK   ${name}`);
  } catch (error) {
    failed = true;
    console.log(`FAIL ${name}: ${error.message.split("\n")[0]}`);
  }
}

/** The link in the newest email sent to our address whose subject contains `subject`. */
async function emailedLink(subject) {
  for (let i = 0; i < 20; i++) {
    const lines = (await readFile(".email-outbox.jsonl", "utf8").catch(() => "")).trim().split("\n").filter(Boolean);
    const mine = lines.map((l) => JSON.parse(l)).filter((m) => m.to === email && m.subject.includes(subject));
    const last = mine.at(-1);
    if (last) return last.text.match(/https?:\/\/\S+/)[0];
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no "${subject}" email for ${email} in .email-outbox.jsonl (is RESEND_API_KEY unset?)`);
}

async function signIn(pass) {
  await page.goto("/signin");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Password").fill(pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function signOut() {
  await page.request.post("/api/auth/sign-out", { data: {}, headers: { origin: BASE } });
}

try {
  await step("signed out: /dashboard redirects to /signin", async () => {
    await page.goto("/dashboard");
    await page.waitForURL("**/signin");
  });
  await step("sign up asks to check email, and does not sign in", async () => {
    await page.goto("/signup");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder(/Password/).fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/verify-email");
    await page.goto("/dashboard");
    await page.waitForURL("**/signin");
  });
  await step("unverified sign-in is refused and points at the email", async () => {
    await signIn(password);
    await page.waitForURL("**/verify-email?state=unverified");
  });
  await step("the emailed link confirms the address and signs in", async () => {
    await page.goto(await emailedLink("Confirm your email"));
    await page.waitForURL("**/household-setup");
  });
  await step("sign out, then /dashboard redirects again", async () => {
    await signOut();
    await page.goto("/dashboard");
    await page.waitForURL("**/signin");
  });
  await step("wrong password is refused", async () => {
    await signIn("not-the-password");
    await page.waitForURL("**/signin?error=invalid-credentials");
  });
  await step("right password signs in", async () => {
    await signIn(password);
    await page.waitForURL("**/household-setup");
    await signOut();
  });
  await step("forgot password: same answer, link by email", async () => {
    await page.goto("/forgot-password");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await page.waitForURL("**/forgot-password?sent=1");
    await emailedLink("Reset your Nest password");
  });
  await step("forgot password does not reveal unknown addresses", async () => {
    await page.goto("/forgot-password");
    await page.getByPlaceholder("you@example.com").fill(`nobody-${Date.now()}@auth-smoke.test`);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await page.waitForURL("**/forgot-password?sent=1");
  });
  await step("reset link sets a new password", async () => {
    await page.goto(await emailedLink("Reset your Nest password"));
    await page.getByPlaceholder(/New password/).fill(newPassword);
    await page.getByPlaceholder("Repeat the new password").fill(newPassword);
    await page.getByRole("button", { name: "Save password" }).click();
    await page.waitForURL("**/signin?reset=1");
  });
  await step("old password no longer works, the new one does", async () => {
    await signIn(password);
    await page.waitForURL("**/signin?error=invalid-credentials");
    await signIn(newPassword);
    await page.waitForURL("**/household-setup");
  });
} finally {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
  await browser.close();
}
process.exit(failed ? 1 : 0);

/**
 * Auth smoke test: sign up, sign out, signed-out redirect, wrong password, sign in.
 *
 *   npm run dev                      # http://localhost:3000, pointed at a dev database
 *   set -a && . ./.env && set +a && node tests/auth/smoke.mjs
 *
 * Creates one throwaway user (@auth-smoke.test) and deletes it afterwards. Refuses to run against anything but
 * localhost. Google sign-in can't be automated and is checked by hand. On the Demo, check "Continue as Alex" by hand.
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.AUTH_SMOKE_URL ?? "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(BASE).hostname)) {
  console.error(`Refusing to run against ${BASE}: the smoke test creates a user.`);
  process.exit(1);
}

const email = `smoke-${Date.now()}@auth-smoke.test`;
const password = "smoke-test-pass-1";
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

async function signIn(pass) {
  await page.goto("/signin");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Password").fill(pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

try {
  await step("signed out: /dashboard redirects to /signin", async () => {
    await page.goto("/dashboard");
    await page.waitForURL("**/signin");
  });
  await step("sign up lands in the app", async () => {
    await page.goto("/signup");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder(/Password/).fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/household-setup");
  });
  await step("sign out, then /dashboard redirects again", async () => {
    await page.request.post("/api/auth/sign-out", { data: {}, headers: { origin: BASE } });
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
  });
} finally {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
  await browser.close();
}
process.exit(failed ? 1 : 0);

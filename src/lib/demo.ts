/**
 * The Demo (see docs/adr/0005): a separate deployment, with its own database,
 * filled with made-up people and money. It is switched on by environment on
 * that deployment only — the real app never sets these, so none of this
 * shows or applies there.
 */
export const DEMO_EMAIL_DOMAIN = "demo.homebase.test";

export const DEMO_PERSONAS = [
  { key: "alex", name: "Alex", email: `alex@${DEMO_EMAIL_DOMAIN}`, blurb: "Has a private savings account" },
  { key: "sam", name: "Sam", email: `sam@${DEMO_EMAIL_DOMAIN}`, blurb: "Shares the household with Alex" },
] as const;

/** True on the Demo's server. Read at request time, so it can't be baked into a real build by accident. */
export function isDemoServer(): boolean {
  return process.env.DEMO_MODE === "true";
}

/** True in the Demo's browser bundle (inlined at build time from NEXT_PUBLIC_DEMO_MODE). */
export const IS_DEMO_CLIENT = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function isDemoEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

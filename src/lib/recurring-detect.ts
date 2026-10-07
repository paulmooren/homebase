/**
 * Finds recurring income, expenses and transfers in transaction history,
 * without touching the database.
 *
 * Transactions are grouped by *who the other party is* first — their IBAN,
 * which stays the same however the bank words the description — and only by
 * cleaned description when the bank gave no IBAN (card payments). A group
 * counts as recurring when it comes back at a regular interval at least
 * three times. A steady amount is "fixed"; one that moves (salary, a phone
 * bill) still counts, flagged as varying.
 */

export type DetectInput = {
  id: string;
  accountId: string;
  /** Owner of the account; null = shared. */
  ownerId: string | null;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  /** Positive, like the database. */
  amount: number;
  date: Date;
  merchant: string;
  counterpartyIban: string | null;
  counterpartyName: string | null;
  categoryId: string | null;
  /** For a TRANSFER: the account it arrives in. */
  transferToAccountId: string | null;
};

export type ScheduleGuess = { count: number; unit: "WEEK" | "MONTH" };

export type DetectedItem = {
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  name: string;
  /** The usual amount: the fixed one, or the average of the last three when it varies. */
  amount: number;
  amountVaries: boolean;
  intervalCount: number;
  intervalUnit: "WEEK" | "MONTH";
  occurrences: number;
  lastDate: Date;
  accountId: string;
  ownerId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  /** How to recognise its transactions later. */
  matchIban: string | null;
  matchText: string | null;
  /** A reference number the description starts with, when the party runs several payments side by side (a savings plan per fund). */
  matchRef: string | null;
  /** Stable identity, so a suggestion that was added or rejected never comes back. */
  matchKey: string;
  /** Strong enough to be ticked by default. */
  confident: boolean;
  transactionIds: string[];
};

const DAY = 86_400_000;
const AMOUNT_TOLERANCE = 0.03;

const SCHEDULES: { guess: ScheduleGuess; min: number; max: number; minOccurrences: number }[] = [
  { guess: { count: 1, unit: "WEEK" }, min: 6, max: 8, minOccurrences: 4 },
  { guess: { count: 2, unit: "WEEK" }, min: 13, max: 15, minOccurrences: 4 },
  { guess: { count: 1, unit: "MONTH" }, min: 26, max: 36, minOccurrences: 3 },
  { guess: { count: 3, unit: "MONTH" }, min: 84, max: 98, minOccurrences: 3 },
];

/** A description with the changing parts (numbers, dates, reference codes, punctuation) removed. */
export function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0-9]+/g, " ")
    .replace(/[^a-zÀ-ɏ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A long number a description starts with: the same for every payment of one plan or contract. */
export function referenceOf(description: string): string | null {
  return description.match(/^\s*(\d{8,})\b/)?.[1] ?? null;
}

function titleCase(text: string) {
  return text === text.toUpperCase() && /[A-Z]/.test(text)
    ? text.toLowerCase().replace(/(^|[\s/&-])([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase())
    : text;
}

/** Two amounts are "the same" within 3% (or a euro, for small ones). */
export function amountWithin(a: number, b: number) {
  return Math.abs(a - b) <= Math.max(1, Math.abs(b) * AMOUNT_TOLERANCE);
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The regular interval these (date-sorted) rows follow, if any. */
function findSchedule(rows: DetectInput[]): ScheduleGuess | null {
  const gaps: number[] = [];
  for (let i = 1; i < rows.length; i++) gaps.push((rows[i].date.getTime() - rows[i - 1].date.getTime()) / DAY);
  if (gaps.length < 2) return null;
  for (const s of SCHEDULES) {
    if (rows.length < s.minOccurrences) continue;
    const inWindow = gaps.filter((g) => g >= s.min && g <= s.max).length;
    // One odd gap is fine in a long history; in a short one, none are.
    if (inWindow / gaps.length >= 0.75 && inWindow >= 2) return s.guess;
  }
  return null;
}

function partyOf(row: DetectInput): { key: string; iban: string | null; text: string | null } {
  if (row.type === "TRANSFER") return { key: `transfer:${row.transferToAccountId}`, iban: null, text: null };
  if (row.counterpartyIban) return { key: `iban:${row.counterpartyIban}`, iban: row.counterpartyIban, text: null };
  const text = cleanText(row.counterpartyName || row.merchant);
  return { key: `text:${text}`, iban: null, text: text || null };
}

/** Bank wording tidied for a name: no trailing ", NL" country code. */
function tidy(text: string) {
  return titleCase(text.replace(/\s+/g, " ").replace(/,\s*[A-Za-z]{2}$/, "").trim());
}

/** A description that reads like a name: short, with no long reference numbers in it. */
function readable(description: string) {
  return description.length <= 40 && !/\d{4,}/.test(description);
}

function nameFor(rows: DetectInput[], accountNames: Map<string, string>): string {
  const last = rows[rows.length - 1];
  if (last.type === "TRANSFER") return `Transfer to ${accountNames.get(last.transferToAccountId ?? "") ?? "another account"}`;

  // The description is the better name when it is steady and readable; otherwise the bank's name for the other party.
  const counts = new Map<string, { n: number; sample: string }>();
  for (const r of rows) {
    const clean = cleanText(r.merchant);
    const entry = counts.get(clean) ?? { n: 0, sample: r.merchant };
    entry.n += 1;
    counts.set(clean, entry);
  }
  const [bestClean, best] = [...counts.entries()].sort((a, b) => b[1].n - a[1].n)[0];
  if (best.n / rows.length >= 0.5 && bestClean.replace(/ /g, "").length >= 4 && readable(best.sample)) {
    return tidy(best.sample);
  }
  if (last.counterpartyName && readable(last.counterpartyName)) return tidy(last.counterpartyName);
  return tidy(bestClean || last.merchant);
}

type Party = { key: string; iban: string | null; text: string | null };

/** Options that only some groupings use: the reference a group was split by, and how recent the account's data is. */
type Context = { ref: string | null; newest: number; clusterAmount: number | null };

function describeGroup(
  rows: DetectInput[],
  party: Party,
  accountNames: Map<string, string>,
  ctx: Context,
): DetectedItem | null {
  const sorted = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const amounts = sorted.map((r) => r.amount);

  // The amount changed and stayed changed (a savings plan stepped down): the new amount is the current one.
  const lastAmount = amounts[amounts.length - 1];
  let run = 0;
  while (run < amounts.length && amountWithin(amounts[amounts.length - 1 - run], lastAmount)) run++;
  if (run >= 2 && run < amounts.length && amounts.length >= 4) {
    const item = buildItem(sorted, party, accountNames, ctx, round2(median(amounts.slice(-run))));
    if (item) return item;
  }

  // A steady amount with a few one-off payments to the same party (the rent, plus a loan back):
  // the steady ones are the recurring item; the odd ones stay what they were.
  const usual = median(amounts);
  const steady = sorted.filter((r) => amountWithin(r.amount, usual));
  if (steady.length < sorted.length && steady.length >= 3 && steady.length >= sorted.length * 0.6) {
    const fixed = buildItem(steady, party, accountNames, ctx, null);
    if (fixed) return fixed;
  }
  return buildItem(sorted, party, accountNames, ctx, null);
}

function buildItem(
  sorted: DetectInput[],
  party: Party,
  accountNames: Map<string, string>,
  ctx: Context,
  /** Set when the amount stepped to a new level: that level, regardless of the older payments. */
  currentAmount: number | null,
): DetectedItem | null {
  const schedule = findSchedule(sorted);
  if (!schedule) return null;

  const last = sorted[sorted.length - 1];
  // Stopped: nothing for over two intervals while the account's data runs on. Not a current cost.
  const intervalDays = schedule.unit === "WEEK" ? 7 * schedule.count : 31 * schedule.count;
  if (ctx.newest - last.date.getTime() > 2 * intervalDays * DAY) return null;

  const amounts = sorted.map((r) => r.amount);
  const mid = median(amounts);
  const amountVaries = currentAmount === null && !amounts.every((a) => amountWithin(a, mid));
  const lastThree = amounts.slice(-3);
  const amount =
    currentAmount ?? (amountVaries ? round2(lastThree.reduce((a, b) => a + b, 0) / lastThree.length) : round2(mid));

  // A wildly swinging amount with no IBAN to vouch for it is more likely habit than obligation.
  const spread = Math.max(...amounts) / Math.max(Math.min(...amounts), 0.01);
  const confident = !amountVaries ? true : party.iban !== null && spread <= 3;

  return {
    type: last.type,
    name: nameFor(sorted, accountNames),
    amount,
    amountVaries,
    intervalCount: schedule.count,
    intervalUnit: schedule.unit,
    occurrences: sorted.length,
    lastDate: last.date,
    accountId: last.accountId,
    ownerId: last.ownerId,
    toAccountId: last.transferToAccountId,
    categoryId: sorted.map((r) => r.categoryId).filter(Boolean).pop() ?? null,
    matchIban: party.iban,
    matchText: party.text,
    matchRef: ctx.ref,
    matchKey: [
      last.accountId,
      last.type,
      party.key,
      ctx.ref ? `ref:${ctx.ref}` : "",
      amountVaries || ctx.clusterAmount === null ? "" : Math.round(mid),
    ].join("|"),
    confident,
    transactionIds: sorted.map((r) => r.id),
  };
}

/** Rows grouped into runs of similar amounts (within the tolerance of the run's first amount). */
function clusterByAmount(rows: DetectInput[]): DetectInput[][] {
  const clusters: { anchor: number; rows: DetectInput[] }[] = [];
  for (const r of [...rows].sort((a, b) => a.amount - b.amount)) {
    const home = clusters.find((c) => amountWithin(r.amount, c.anchor));
    if (home) home.rows.push(r);
    else clusters.push({ anchor: r.amount, rows: [r] });
  }
  return clusters.map((c) => c.rows);
}

export function detectRecurring(
  transactions: DetectInput[],
  accountNames: Map<string, string> = new Map(),
): DetectedItem[] {
  // How far each account's data runs, so a pattern that stopped long ago isn't suggested as current.
  const newest = new Map<string, number>();
  for (const tx of transactions) newest.set(tx.accountId, Math.max(newest.get(tx.accountId) ?? 0, tx.date.getTime()));

  const groups = new Map<string, { party: Party; rows: DetectInput[] }>();
  for (const tx of transactions) {
    const party = partyOf(tx);
    if (party.key === "text:" && !party.iban) continue;
    const key = `${tx.accountId}|${tx.type}|${party.key}`;
    const group = groups.get(key) ?? { party, rows: [] };
    group.rows.push(tx);
    groups.set(key, group);
  }

  const items: DetectedItem[] = [];
  for (const { party, rows } of groups.values()) {
    if (rows.length < 3) continue;
    const base = { newest: newest.get(rows[0].accountId) ?? 0 };
    const whole = describeGroup(rows, party, accountNames, { ...base, ref: null, clusterAmount: null });
    if (whole) {
      items.push(whole);
      continue;
    }
    if (rows.length < 4) continue;

    // Several payments to the same party each month: follow each plan by the reference its description starts with…
    const byRef = new Map<string, DetectInput[]>();
    for (const r of rows) {
      const ref = party.iban ? referenceOf(r.merchant) : null;
      if (ref) byRef.set(ref, [...(byRef.get(ref) ?? []), r]);
    }
    let found = 0;
    for (const [ref, refRows] of byRef) {
      if (refRows.length < 3) continue;
      const sub = describeGroup(refRows, party, accountNames, { ...base, ref, clusterAmount: null });
      if (sub) {
        items.push(sub);
        found++;
      }
    }
    if (found > 0) continue;

    // …or, with no reference to follow, look for a steady amount inside it.
    for (const cluster of clusterByAmount(rows)) {
      if (cluster.length < 3) continue;
      const sub = describeGroup(cluster, party, accountNames, { ...base, ref: null, clusterAmount: cluster[0].amount });
      if (sub) items.push(sub);
    }
  }
  return items;
}

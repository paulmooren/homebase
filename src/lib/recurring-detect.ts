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

function describeGroup(
  rows: DetectInput[],
  party: { key: string; iban: string | null; text: string | null },
  accountNames: Map<string, string>,
  clusterAmount: number | null,
): DetectedItem | null {
  const sorted = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());

  // A steady amount with a few one-off payments to the same party (the rent, plus a loan back):
  // the steady ones are the recurring item; the odd ones stay what they were.
  const usual = median(sorted.map((r) => r.amount));
  const steady = sorted.filter((r) => amountWithin(r.amount, usual));
  if (steady.length < sorted.length && steady.length >= 3 && steady.length >= sorted.length * 0.6) {
    const fixed = buildItem(steady, party, accountNames, clusterAmount);
    if (fixed) return fixed;
  }
  return buildItem(sorted, party, accountNames, clusterAmount);
}

function buildItem(
  sorted: DetectInput[],
  party: { key: string; iban: string | null; text: string | null },
  accountNames: Map<string, string>,
  clusterAmount: number | null,
): DetectedItem | null {
  const schedule = findSchedule(sorted);
  if (!schedule) return null;

  const amounts = sorted.map((r) => r.amount);
  const mid = median(amounts);
  const amountVaries = !amounts.every((a) => amountWithin(a, mid));
  const last = sorted[sorted.length - 1];
  const lastThree = amounts.slice(-3);
  const amount = amountVaries ? round2(lastThree.reduce((a, b) => a + b, 0) / lastThree.length) : round2(mid);

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
    matchKey: [last.accountId, last.type, party.key, amountVaries || clusterAmount === null ? "" : Math.round(mid)].join("|"),
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
  const groups = new Map<string, { party: ReturnType<typeof partyOf>; rows: DetectInput[] }>();
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
    const whole = describeGroup(rows, party, accountNames, null);
    if (whole) {
      items.push(whole);
      continue;
    }
    // Several different payments to the same party (savings, a shared account):
    // look for a steady amount inside it.
    if (rows.length >= 4) {
      for (const cluster of clusterByAmount(rows)) {
        if (cluster.length < 3) continue;
        const sub = describeGroup(cluster, party, accountNames, cluster[0].amount);
        if (sub) items.push(sub);
      }
    }
  }
  return items;
}

/**
 * Plans what a bank statement import should do, without touching the
 * database: which rows are new, which are already there (and only need the
 * other party filled in), and which are moves between two tracked accounts
 * that must end up as one Transfer instead of an expense plus an income.
 *
 * Importing the same statement twice changes nothing; importing the other
 * side of a move finds the Transfer already there.
 */

export type IncomingRow = {
  date: Date;
  merchant: string;
  /** Negative = money out, positive = money in. */
  amount: number;
  categoryId: string | null;
  counterpartyIban: string | null;
  counterpartyName: string | null;
};

export type ExistingTxn = {
  id: string;
  accountId: string;
  transferToAccountId: string | null;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  /** Always positive, like the database. */
  amount: number;
  date: Date;
  merchant: string;
  counterpartyIban: string | null;
  counterpartyName: string | null;
};

export type TrackedAccount = { id: string; iban: string | null; editable: boolean };

export type NewTxn = {
  accountId: string;
  transferToAccountId: string | null;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  amount: number;
  date: Date;
  merchant: string;
  categoryId: string | null;
  counterpartyIban: string | null;
  counterpartyName: string | null;
};

export type TxnUpdate = {
  id: string;
  data: Partial<
    Pick<ExistingTxn, "accountId" | "transferToAccountId" | "type" | "counterpartyIban" | "counterpartyName">
  >;
};

export type ImportPlan = {
  create: NewTxn[];
  update: TxnUpdate[];
  remove: string[];
  /** Rows that were already there and needed nothing. */
  unchanged: number;
  /** Of the created or converted rows, how many are transfers between tracked accounts. */
  transfers: number;
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const cents = (n: number) => Math.round(n * 100);

/** An existing row seen from the importing account: its signed amount on that account. */
type Leg = { row: ExistingTxn; signed: number };

export function planImport(args: {
  accountId: string;
  /** The importing account's IBAN (stored, or read from the file). */
  accountIban: string | null;
  accounts: TrackedAccount[];
  existing: ExistingTxn[];
  rows: IncomingRow[];
}): ImportPlan {
  const { accountId, accountIban, accounts, existing, rows } = args;

  const byIban = new Map<string, TrackedAccount>();
  for (const a of accounts) if (a.iban) byIban.set(a.iban, a);

  const legs: Leg[] = [];
  for (const row of existing) {
    if (row.type === "TRANSFER") {
      if (row.accountId === accountId) legs.push({ row, signed: -cents(row.amount) });
      else if (row.transferToAccountId === accountId) legs.push({ row, signed: cents(row.amount) });
    } else if (row.accountId === accountId) {
      legs.push({ row, signed: row.type === "EXPENSE" ? -cents(row.amount) : cents(row.amount) });
    }
  }

  const exactKey = (date: Date, signed: number, merchant: string) => `${dayKey(date)}|${signed}|${merchant}`;
  const looseKey = (date: Date, signed: number) => `${dayKey(date)}|${signed}`;
  const exact = new Map<string, Leg[]>();
  const loose = new Map<string, Leg[]>();
  for (const leg of legs) {
    const e = exactKey(leg.row.date, leg.signed, leg.row.merchant);
    const l = looseKey(leg.row.date, leg.signed);
    exact.set(e, [...(exact.get(e) ?? []), leg]);
    loose.set(l, [...(loose.get(l) ?? []), leg]);
  }

  const consumed = new Set<string>();
  function take(map: Map<string, Leg[]>, key: string): Leg | null {
    const leg = map.get(key)?.find((l) => !consumed.has(l.row.id));
    if (!leg) return null;
    consumed.add(leg.row.id);
    return leg;
  }

  // Each row matched to the existing row it already is, or null if it's new.
  const matches: (Leg | null)[] = rows.map(() => null);
  const signedOf = (r: IncomingRow) => cents(r.amount);
  rows.forEach((r, i) => {
    matches[i] = take(exact, exactKey(r.date, signedOf(r), r.merchant));
  });
  // A renamed or reworded row is still the same payment: same day, same amount.
  rows.forEach((r, i) => {
    if (!matches[i]) matches[i] = take(loose, looseKey(r.date, signedOf(r)));
  });

  const plan: ImportPlan = { create: [], update: [], remove: [], unchanged: 0, transfers: 0 };

  /** The other account, when this row is a move between two accounts we can edit. */
  function counterpartAccount(r: IncomingRow): TrackedAccount | null {
    if (!r.counterpartyIban) return null;
    const other = byIban.get(r.counterpartyIban);
    return other && other.id !== accountId && other.editable ? other : null;
  }

  /** The same movement as the other account's own plain row, so it can be dropped for the Transfer. */
  function takeMirror(r: IncomingRow, other: TrackedAccount) {
    const wanted = r.amount < 0 ? "INCOME" : "EXPENSE";
    const mirror = existing.find(
      (e) =>
        e.accountId === other.id &&
        e.type === wanted &&
        !consumed.has(e.id) &&
        cents(e.amount) === Math.abs(signedOf(r)) &&
        dayKey(e.date) === dayKey(r.date) &&
        (e.counterpartyIban === null || e.counterpartyIban === accountIban),
    );
    if (mirror) {
      consumed.add(mirror.id);
      plan.remove.push(mirror.id);
    }
  }

  rows.forEach((r, i) => {
    const other = counterpartAccount(r);
    const leg = matches[i];

    if (leg && leg.row.type === "TRANSFER") {
      plan.unchanged += 1;
      return;
    }

    if (leg && other) {
      // Already imported as a plain expense/income; it is really a move between our accounts.
      const [from, to] = r.amount < 0 ? [accountId, other.id] : [other.id, accountId];
      plan.update.push({
        id: leg.row.id,
        data: {
          type: "TRANSFER",
          accountId: from,
          transferToAccountId: to,
          counterpartyIban: r.counterpartyIban,
          counterpartyName: r.counterpartyName,
        },
      });
      takeMirror(r, other);
      plan.transfers += 1;
      return;
    }

    if (leg) {
      const data: TxnUpdate["data"] = {};
      if (r.counterpartyIban && leg.row.counterpartyIban !== r.counterpartyIban) data.counterpartyIban = r.counterpartyIban;
      if (r.counterpartyName && leg.row.counterpartyName !== r.counterpartyName) data.counterpartyName = r.counterpartyName;
      if (Object.keys(data).length > 0) plan.update.push({ id: leg.row.id, data });
      else plan.unchanged += 1;
      return;
    }

    if (other) {
      const [from, to] = r.amount < 0 ? [accountId, other.id] : [other.id, accountId];
      plan.create.push({
        accountId: from,
        transferToAccountId: to,
        type: "TRANSFER",
        amount: Math.abs(r.amount),
        date: r.date,
        merchant: r.merchant,
        categoryId: null,
        counterpartyIban: r.counterpartyIban,
        counterpartyName: r.counterpartyName,
      });
      takeMirror(r, other);
      plan.transfers += 1;
      return;
    }

    plan.create.push({
      accountId,
      transferToAccountId: null,
      type: r.amount < 0 ? "EXPENSE" : "INCOME",
      amount: Math.abs(r.amount),
      date: r.date,
      merchant: r.merchant,
      categoryId: r.categoryId,
      counterpartyIban: r.counterpartyIban,
      counterpartyName: r.counterpartyName,
    });
  });

  return plan;
}

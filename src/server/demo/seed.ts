import type { Prisma, PrismaClient } from "@prisma/client";

import { DEFAULT_CATEGORIES } from "@/lib/constants";
import { DEMO_PERSONAS, isDemoEmail } from "@/lib/demo";
import { amountForBasis } from "@/lib/budget-basis";
import { addInterval, todayInHousehold } from "@/lib/schedule";
import { recomputeNetWorthSnapshot } from "@/server/api/net-worth";
import { attachRecurringTransactions } from "@/server/api/recurring-match";
import { encryptValue } from "@/server/vault-crypto";

/**
 * Fills the Demo with one made-up household (Alex and Sam), with dates counted
 * back from today so it always looks current: about nine months of history
 * ending now.
 *
 * It only ever replaces the household of the two demo people (found by their
 * demo email addresses), so even pointed at the wrong database it cannot touch
 * anyone else's data. Everything is deterministic: the same day gives the
 * same household, so a reset always lands in the same state.
 */

/** Small seeded random numbers, so "random" spending is the same on every run. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iban = (n: number) => `NL${String(10 + (n % 80)).padStart(2, "0")}DEMO${String(n).padStart(10, "0")}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

type Tx = Omit<Prisma.TransactionCreateManyInput, "householdId">;

export async function seedDemo(prisma: PrismaClient, now: Date = new Date()) {
  const started = Date.now();
  const lap = (label: string) => {
    if (process.env.DEMO_SEED_TIMING) console.log(`  ${label}: ${((Date.now() - started) / 1000).toFixed(1)}s`);
  };
  const today = todayInHousehold(now);
  const rand = mulberry32(today.getUTCFullYear() * 400 + today.getUTCMonth() * 31 + 7);
  const between = (lo: number, hi: number) => round2(lo + rand() * (hi - lo));
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];

  // ── The two people, and a clean slate for their household ────────────────
  const people = new Map<string, { id: string }>();
  for (const p of DEMO_PERSONAS) {
    if (!isDemoEmail(p.email)) throw new Error("Demo personas must use the demo email domain.");
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { name: p.name, onboardedAt: now, image: null },
      create: { email: p.email, name: p.name, onboardedAt: now },
      select: { id: true },
    });
    people.set(p.key, user);
  }
  const alex = people.get("alex")!.id;
  const sam = people.get("sam")!.id;

  const old = await prisma.householdMember.findMany({ where: { userId: { in: [alex, sam] } }, select: { householdId: true } });
  await prisma.household.deleteMany({ where: { id: { in: old.map((m) => m.householdId) } } });

  const household = await prisma.household.create({ data: { name: "Alex & Sam" }, select: { id: true } });
  const householdId = household.id;
  await prisma.householdMember.createMany({
    data: [
      { householdId, userId: alex },
      { householdId, userId: sam },
    ],
  });

  await prisma.category.createMany({ data: DEFAULT_CATEGORIES.map((c) => ({ householdId, name: c.name, color: c.color })) });
  const categories = new Map((await prisma.category.findMany({ where: { householdId } })).map((c) => [c.name, c.id]));
  const cat = (name: string) => categories.get(name) ?? null;

  lap("people + clean slate");
  // ── Accounts ─────────────────────────────────────────────────────────────
  const A = { current: iban(1), savings: iban(2), samCurrent: iban(3), daily: iban(4), holiday: iban(5) };
  const accountDefs = [
    { key: "alexCur", name: "Alex · Current", type: "CHECKING", owner: alex, visible: true, iban: A.current, start: 1850, institution: "Demo Bank" },
    // Private: Sam can't see this one — the whole point of showing two people.
    { key: "alexSav", name: "Alex · Savings", type: "SAVINGS", owner: alex, visible: false, iban: A.savings, start: 8200, institution: "Demo Bank" },
    { key: "samCur", name: "Sam · Current", type: "CHECKING", owner: sam, visible: true, iban: A.samCurrent, start: 2100, institution: "Demo Bank" },
    { key: "daily", name: "Shared · Daily", type: "CHECKING", owner: null, visible: true, iban: A.daily, start: 900, institution: "Demo Bank" },
    { key: "holiday", name: "Shared · Holiday fund", type: "SAVINGS", owner: null, visible: true, iban: A.holiday, start: 3400, institution: "Demo Bank" },
    { key: "card", name: "Shared · Credit card", type: "CREDIT_CARD", owner: null, visible: true, iban: null, start: 380, institution: "Demo Bank" },
    { key: "loan", name: "Shared · Car loan", type: "LOAN", owner: null, visible: true, iban: null, start: 9600, institution: "Demo Finance" },
  ] as const;
  const acc: Record<string, string> = {};
  await Promise.all(
    accountDefs.map(async (a) => {
      const created = await prisma.financialAccount.create({
        data: {
          householdId,
          ownerId: a.owner,
          visibleToHousehold: a.visible,
          name: a.name,
          institution: a.institution,
          iban: a.iban,
          type: a.type,
          startingBalance: a.start,
          balance: a.start,
        },
        select: { id: true },
      });
      acc[a.key] = created.id;
    }),
  );

  lap("accounts");
  // ── Months, from nine months ago up to today ─────────────────────────────
  const monthOffsets = Array.from({ length: 10 }, (_, i) => i - 9); // -9 … 0
  const dayOf = (offset: number, day: number): Date | null => {
    const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, last)));
    return date.getTime() > today.getTime() ? null : date;
  };

  const txs: Tx[] = [];
  const parties = {
    northwind: { name: "Northwind Labs B.V.", iban: iban(100) },
    brightside: { name: "Brightside Studio", iban: iban(101) },
    oakstone: { name: "Oakstone Housing", iban: iban(102) },
    power: { name: "PowerGrid Energy", iban: iban(103) },
    fibre: { name: "FibreNet", iban: iban(104) },
    greenfield: { name: "Greenfield Insurance", iban: iban(105) },
    fithub: { name: "FitHub Club", iban: iban(106) },
    streambox: { name: "StreamBox", iban: iban(107) },
    yoga: { name: "Yoga Loft", iban: iban(108) },
    nimbus: { name: "Nimbus Cloud", iban: iban(109) },
    telefix: { name: "Telefix Mobile", iban: iban(110) },
    water: { name: "Aquavita Water", iban: iban(111) },
    lakeside: { name: "Lakeside Resorts", iban: iban(112) },
  };

  /** A payment to or from a named party with an account number — the kind recurring items are recognised by. */
  const party = (
    key: string,
    p: { name: string; iban: string },
    type: "EXPENSE" | "INCOME",
    amount: number,
    date: Date | null,
    description: string,
    category: string,
  ) => {
    if (!date) return;
    txs.push({
      accountId: acc[key],
      type,
      amount,
      date,
      merchant: description,
      categoryId: cat(category),
      counterpartyIban: p.iban,
      counterpartyName: p.name,
    });
  };
  const transfer = (from: string, to: string, amount: number, date: Date | null, description: string) => {
    if (!date) return;
    txs.push({ accountId: acc[from], transferToAccountId: acc[to], type: "TRANSFER", amount, date, merchant: description });
  };
  /** Everyday card spending: no account number, just a merchant. */
  const everyday = (key: string, merchant: string, amount: number, date: Date | null, category: string) => {
    if (!date) return;
    txs.push({
      accountId: acc[key],
      type: "EXPENSE",
      amount,
      date,
      merchant: `${merchant}, NL`,
      categoryId: cat(category),
      counterpartyName: merchant,
    });
  };

  const energyByMonth = [142, 138, 121, 104, 92, 86, 84, 88, 101, 118, 131, 146]; // winter dearer
  const eatOut = ["Bistro Nolita", "Noodle Bar Kaito", "The Corner Table", "Pizzeria Luna", "Café Almond"];
  const getAround = ["City Rail", "Metro Pass Top-up", "Fuel Stop 24", "Bike Repair Co"];
  const shops = ["Parcel Express", "Home & Hearth", "Studio Threads", "Page Turner Books"];
  const care = ["Apothecary Plus", "Dr. Visser Practice"];
  const fun = ["Cinema Orbit", "Concert Hall Tickets"];

  for (const o of monthOffsets) {
    const monthOfYear = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + o, 1)).getUTCMonth();

    // Alex: salary (a bonus month, then a raise), and the standing arrangements.
    const salary = o === -5 ? 5215 : o >= -2 ? 3540 : 3420;
    party("alexCur", parties.northwind, "INCOME", salary, dayOf(o, 25), o === -5 ? "Salary and bonus" : "Salary", "Income");
    transfer("alexCur", "daily", 1650, dayOf(o, 1), "To Shared · Daily");
    transfer("alexCur", "alexSav", 300, dayOf(o, 26), "To Alex · Savings");
    party("alexCur", parties.fithub, "EXPENSE", 34.9, dayOf(o, 3), "FitHub membership", "Health");
    party("alexCur", parties.streambox, "EXPENSE", 12.99, dayOf(o, 12), "StreamBox", "Subscriptions");
    party("alexCur", parties.telefix, "EXPENSE", o >= -1 ? 19.95 : 18.5, dayOf(o, 14), "Telefix mobile plan", "Subscriptions");

    // Sam
    party("samCur", parties.brightside, "INCOME", 2980, dayOf(o, 27), "Salary", "Income");
    transfer("samCur", "daily", 1550, dayOf(o, 2), "To Shared · Daily");
    party("samCur", parties.yoga, "EXPENSE", 49, dayOf(o, 5), "Yoga Loft membership", "Health");
    party("samCur", parties.nimbus, "EXPENSE", 2.99, dayOf(o, 9), "Nimbus Cloud storage", "Subscriptions");

    // Shared: the household's fixed costs
    party("daily", parties.oakstone, "EXPENSE", 1350, dayOf(o, 1), "Rent", "Housing & Utilities");
    party("daily", parties.fibre, "EXPENSE", 49.95, o >= -1 ? null : dayOf(o, 8), "Internet", "Housing & Utilities"); // the last two are late
    party("daily", parties.power, "EXPENSE", round2(energyByMonth[monthOfYear] + between(-6, 6)), dayOf(o, 15), "Energy", "Housing & Utilities");
    party("daily", parties.water, "EXPENSE", 24.5, dayOf(o, 18), "Water", "Housing & Utilities");
    party("daily", parties.greenfield, "EXPENSE", 86.4, dayOf(o, 20), "Home and liability insurance", "Housing & Utilities");
    transfer("daily", "holiday", 200, dayOf(o, 3), "To Shared · Holiday fund");
    transfer("daily", "loan", 320, dayOf(o, 4), "Car loan instalment");
    transfer("daily", "card", 450, dayOf(o, 28), "Credit card payment");
    if (o === -4) party("holiday", parties.lakeside, "EXPENSE", 640, dayOf(o, 10), "Summer trip deposit", "Travel");

    // Everyday spending, scattered through each month
    const spend = (key: string, merchants: readonly string[], n: number, lo: number, hi: number, category: string, last = 28) => {
      for (let i = 0; i < n; i++) everyday(key, pick(merchants), between(lo, hi), dayOf(o, 1 + Math.floor(rand() * last)), category);
    };
    spend("daily", ["Fresh Market"], 5, 28, 96, "Groceries");
    spend("daily", ["Corner Bakery", "Green Basket"], 3, 6, 18, "Groceries");
    spend("daily", care, rand() < 0.5 ? 1 : 0, 6, 45, "Health");
    spend("alexCur", eatOut, 3, 9, 54, "Dining");
    spend("alexCur", getAround, 3, 3, 58, "Transport");
    spend("alexCur", shops, 1 + Math.floor(rand() * 2), 14, 120, "Shopping");
    spend("alexCur", fun, 1, 12, 60, "Entertainment");
    spend("samCur", eatOut, 3, 9, 54, "Dining");
    spend("samCur", getAround, 2, 3, 58, "Transport");
    spend("samCur", shops, 2, 14, 120, "Shopping");
    spend("samCur", fun, 1, 12, 60, "Entertainment");
    spend("card", eatOut, 3, 24, 88, "Dining");
    spend("card", shops, 2, 30, 140, "Shopping");
    spend("card", ["City Rail", "Fuel Stop 24"], 2, 18, 70, "Transport");
    spend("card", fun, 1, 20, 80, "Entertainment");
  }

  // Keep the current and savings accounts out of the red: a starting balance that carries the lowest point above €300.
  const delta = new Map<string, Tx[]>();
  for (const t of txs) {
    for (const key of [t.accountId, t.transferToAccountId ?? ""]) {
      if (key) delta.set(key, [...(delta.get(key) ?? []), t]);
    }
  }
  const bumps: Promise<unknown>[] = [];
  for (const a of accountDefs) {
    if (a.type !== "CHECKING" && a.type !== "SAVINGS") continue;
    const id = acc[a.key];
    const rows = (delta.get(id) ?? []).sort((x, y) => (x.date as Date).getTime() - (y.date as Date).getTime());
    let running = 0;
    let lowest = 0;
    for (const t of rows) {
      const amount = Number(t.amount);
      running += t.type === "INCOME" ? amount : t.type === "EXPENSE" ? -amount : t.accountId === id ? -amount : amount;
      lowest = Math.min(lowest, running);
    }
    const start = Math.max(a.start, Math.ceil(300 - lowest));
    if (start !== a.start) bumps.push(prisma.financialAccount.update({ where: { id }, data: { startingBalance: start } }));
  }
  await Promise.all(bumps);

  lap("transactions generated");
  await prisma.transaction.createMany({
    data: txs.filter((t) => Number(t.amount) > 0).map((t) => ({ ...t, householdId })),
  });

  lap("transactions stored");
  // ── Recurring items the household has already confirmed ──────────────────
  type ItemDef = {
    name: string;
    type: "EXPENSE" | "INCOME" | "TRANSFER";
    account: string;
    to?: string;
    owner: string | null;
    amount: number;
    basis?: "LATEST" | "LOWEST" | "HIGHEST" | "AVERAGE" | "FIXED";
    varies?: boolean;
    party?: { iban: string };
    category?: string;
    /** After linking, take the amount from the payments by the item's basis. */
    fromPayments?: boolean;
  };
  const items: ItemDef[] = [
    // Salary stays at the old figure on purpose: the newer, higher payments become a proposal to approve.
    { name: "Salary — Northwind Labs", type: "INCOME", account: "alexCur", owner: alex, amount: 3420, basis: "LATEST", varies: true, party: parties.northwind, category: "Income" },
    { name: "Salary — Brightside Studio", type: "INCOME", account: "samCur", owner: sam, amount: 2980, basis: "LATEST", party: parties.brightside, category: "Income" },
    { name: "Rent", type: "EXPENSE", account: "daily", owner: null, amount: 1350, basis: "FIXED", party: parties.oakstone, category: "Housing & Utilities" },
    { name: "Energy", type: "EXPENSE", account: "daily", owner: null, amount: 100, basis: "AVERAGE", varies: true, party: parties.power, category: "Housing & Utilities", fromPayments: true },
    { name: "Internet", type: "EXPENSE", account: "daily", owner: null, amount: 49.95, basis: "FIXED", party: parties.fibre, category: "Housing & Utilities" },
    { name: "Water", type: "EXPENSE", account: "daily", owner: null, amount: 24.5, basis: "FIXED", party: parties.water, category: "Housing & Utilities" },
    { name: "Home and liability insurance", type: "EXPENSE", account: "daily", owner: null, amount: 86.4, basis: "FIXED", party: parties.greenfield, category: "Housing & Utilities" },
    { name: "Transfer to Shared · Daily (Alex)", type: "TRANSFER", account: "alexCur", to: "daily", owner: alex, amount: 1650, basis: "FIXED" },
    { name: "Transfer to Shared · Daily (Sam)", type: "TRANSFER", account: "samCur", to: "daily", owner: sam, amount: 1550, basis: "FIXED" },
    { name: "Monthly savings", type: "TRANSFER", account: "alexCur", to: "alexSav", owner: alex, amount: 300, basis: "FIXED" },
    { name: "Holiday fund", type: "TRANSFER", account: "daily", to: "holiday", owner: null, amount: 200, basis: "FIXED" },
    { name: "Car loan", type: "TRANSFER", account: "daily", to: "loan", owner: null, amount: 320, basis: "FIXED" },
    { name: "Credit card payment", type: "TRANSFER", account: "daily", to: "card", owner: null, amount: 450, basis: "FIXED" },
  ];
  const createdItems = await Promise.all(
    items.map(async (def) => {
      const created = await prisma.recurringItem.create({
        data: {
          householdId,
          ownerId: def.owner,
          accountId: acc[def.account],
          toAccountId: def.to ? acc[def.to] : null,
          visibleToHousehold: true,
          name: def.name,
          type: def.type,
          amount: def.amount,
          amountVaries: def.varies ?? false,
          basis: def.basis ?? "LATEST",
          intervalCount: 1,
          intervalUnit: "MONTH",
          categoryId: def.category ? cat(def.category) : null,
          matchIban: def.party?.iban ?? null,
          source: "DETECTED",
          status: "ACTIVE",
        },
        select: { id: true },
      });
      return { id: created.id, def };
    }),
  );
  // Link the payments the same way the app does after every import.
  await attachRecurringTransactions(prisma, householdId);
  for (const { id, def } of createdItems) {
    if (!def.fromPayments) continue;
    const payments = await prisma.transaction.findMany({ where: { recurringItemId: id }, orderBy: { date: "asc" }, select: { amount: true } });
    const amount = amountForBasis(def.basis ?? "LATEST", payments.map((p) => Number(p.amount)));
    if (amount !== null) await prisma.recurringItem.update({ where: { id }, data: { amount } });
  }

  lap("recurring items + attach");
  // ── Budgets ──────────────────────────────────────────────────────────────
  const budget = (name: string, amount: number, owner: string | null) => ({
    householdId,
    categoryId: cat(name)!,
    ownerId: owner,
    ownerScope: owner ?? "HOUSEHOLD",
    monthlyAmount: amount,
    visibleToHousehold: true,
  });
  await prisma.budget.createMany({
    data: [
      budget("Groceries", 480, null),
      budget("Dining", 220, null),
      budget("Transport", 160, null),
      budget("Shopping", 250, null),
      budget("Entertainment", 120, null),
      budget("Dining", 90, alex),
    ],
  });

  lap("budgets");
  // ── Todos and reminders ──────────────────────────────────────────────────
  const daysFromToday = (n: number) => addInterval(today, n, "DAY");
  await prisma.task.createMany({
    data: [
      { householdId, ownerId: alex, title: "Book a dentist appointment", priority: "HIGH" },
      { householdId, ownerId: sam, title: "Compare energy contracts", priority: "MEDIUM" },
      { householdId, ownerId: null, title: "Plan the weekend away", priority: "MEDIUM" },
      { householdId, ownerId: alex, title: "Replace the bike lock", priority: "LOW" },
      { householdId, ownerId: sam, title: "Send the rent receipt to the landlord", priority: "HIGH", completedAt: daysFromToday(-1) },
    ],
  });
  const reminderDefs = [
    { title: "Hoover the living room", owner: alex, count: 1, unit: "WEEK", due: -2, mode: "FROM_DONE" },
    { title: "Water the plants", owner: sam, count: 3, unit: "DAY", due: 0, mode: "FROM_DONE" },
    { title: "Clean the bathroom", owner: null, count: 2, unit: "WEEK", due: 3, mode: "FROM_DONE" },
    { title: "Put the paper recycling out", owner: sam, count: 2, unit: "WEEK", due: 6, mode: "FIXED" },
    { title: "Descale the kettle", owner: alex, count: 2, unit: "MONTH", due: 20, mode: "FROM_DONE" },
    { title: "Service the boiler", owner: null, count: 1, unit: "YEAR", due: 55, mode: "FIXED" },
  ] as const;
  await Promise.all(
    reminderDefs.map(async (r) => {
      const reminder = await prisma.reminder.create({
        data: { householdId, ownerId: r.owner, title: r.title, intervalCount: r.count, intervalUnit: r.unit, mode: r.mode, nextDueDate: daysFromToday(r.due) },
        select: { id: true },
      });
      if (r.title === "Water the plants") {
        await prisma.reminderCompletion.createMany({
          data: [3, 6, 9].map((d) => ({ reminderId: reminder.id, completedById: sam, completedAt: daysFromToday(-d), dueDateAtCompletion: daysFromToday(-d) })),
        });
      }
    }),
  );

  lap("todos + reminders");
  // ── Shopping lists ───────────────────────────────────────────────────────
  const [groceries, hardware, gifts] = await Promise.all([
    prisma.shoppingList.create({ data: { householdId, ownerId: null, name: "Groceries" }, select: { id: true } }),
    prisma.shoppingList.create({ data: { householdId, ownerId: null, name: "Hardware store" }, select: { id: true } }),
    // A private list: only Alex sees it.
    prisma.shoppingList.create({ data: { householdId, ownerId: alex, name: "Gift ideas for Sam" }, select: { id: true } }),
  ]);
  await Promise.all([
    prisma.shoppingItem.createMany({
      data: [
        { listId: groceries.id, name: "Oat milk", quantity: "2", addedById: alex },
        { listId: groceries.id, name: "Tomatoes", quantity: "4", addedById: sam },
        { listId: groceries.id, name: "Pasta", addedById: sam },
        { listId: groceries.id, name: "Dish soap", addedById: alex },
        { listId: groceries.id, name: "Coffee beans", addedById: alex, checkedAt: now },
        { listId: groceries.id, name: "Eggs", quantity: "10", addedById: sam, checkedAt: now },
        { listId: hardware.id, name: "Light bulbs (E27)", quantity: "4", addedById: sam },
        { listId: hardware.id, name: "Wall plugs", addedById: alex },
        { listId: gifts.id, name: "Linen shirt", addedById: alex },
        { listId: gifts.id, name: "Concert tickets", note: "Their birthday, in the spring", addedById: alex },
      ],
    }),
    prisma.shoppingFavorite.createMany({
      data: ["Oat milk", "Eggs", "Bananas", "Coffee beans", "Olive oil"].map((name) => ({ listId: groceries.id, name })),
    }),
  ]);

  lap("shopping");
  // ── Wishlists ────────────────────────────────────────────────────────────
  await prisma.wish.createMany({
    data: [
      // Sam has claimed this one; Alex, the owner, never sees that.
      { householdId, ownerId: alex, title: "Noise-cancelling headphones", price: 279, url: "https://example.com/headphones", claimedById: sam },
      { householdId, ownerId: alex, title: "Trail running shoes", price: 140, note: "Size 43" },
      { householdId, ownerId: sam, title: "Ceramic pour-over coffee set", price: 64, url: "https://example.com/pour-over", claimedById: alex },
      { householdId, ownerId: sam, title: "A weekend city break", note: "Anywhere with good food" },
      { householdId, ownerId: null, title: "Robot vacuum", price: 399, url: "https://example.com/robot-vacuum" },
      { householdId, ownerId: null, title: "Balcony furniture set", price: 520 },
      { householdId, ownerId: alex, title: "Sketchbook and pens", price: 35, receivedAt: daysFromToday(-40) },
    ],
  });

  lap("wishlists");
  // ── Vault: made-up values, encrypted like real ones ──────────────────────
  const enc = (v: string) => encryptValue(v, householdId);
  const vault = (title: string, category: string, owner: string | null, visible: boolean, expiresInDays: number | null, fields: [string, string][], note?: string) =>
    prisma.vaultEntry.create({
      data: {
        householdId,
        ownerId: owner,
        visibleToHousehold: visible,
        title,
        category,
        expiresOn: expiresInDays === null ? null : daysFromToday(expiresInDays),
        fields: fields.map(([label, value]) => ({ label, value: enc(value) })),
        noteEnc: note ? enc(note) : null,
      },
    });
  await Promise.all([
    vault("Passport — Alex", "ID", alex, true, 40, [["Number", "NX0000000"]], "Renew before the summer trip"),
    vault("Home and liability insurance", "Insurance", null, true, 210, [["Policy number", "GF-0098213"], ["Claims line", "+31 00 000 0000"]]),
    vault("Wi-Fi at home", "Utility", null, true, null, [["Network", "Homebase-5G"], ["Password", "not-a-real-password"]]),
    vault("Car registration", "Vehicle", null, true, 320, [["Plate", "00-DEM-0"]]),
    vault("Driving licence — Sam", "ID", sam, false, 900, [["Number", "DL0000000"]]),
  ]);

  lap("vault");
  // ── Balances and the net-worth history follow from the transactions ──────
  await recomputeNetWorthSnapshot(prisma, householdId);

  lap("net worth");
  return { householdId, transactions: txs.filter((t) => Number(t.amount) > 0).length, recurringItems: items.length };
}

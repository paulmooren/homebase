"use client";

import { accountDelta } from "@/lib/account-balance";
import { newId } from "@/lib/client-id";
import { trpc } from "@/trpc/react";
import { asCached, asDate, useOptimisticMutation, type CacheEditor, type QueryPath } from "@/trpc/optimistic";

/** Everything a transaction change can alter on screen: the lists, the balances and the dashboard figures. */
const BALANCE_LISTS = [
  "transaction.list",
  "account.list",
  "dashboard.summary",
  "dashboard.netWorthHistory",
  "dashboard.accountHistory",
  "dashboard.missingStatements",
  "budget.list",
] as const satisfies readonly QueryPath[];

/** What a bulk change that waits for the server (an import, "remove all") must refresh when it is done. */
export const AFTER_BULK_TRANSACTION_CHANGE = [...BALANCE_LISTS, "recurring.list", "recurring.suggestions"] as const satisfies readonly QueryPath[];

type Row = { accountId: string; transferToAccountId: string | null; type: string; amount: unknown };

/** Moves the balances of the account(s) a transaction touches, as the server's recompute would (`sign` -1 takes it back out). */
function moveBalances(cache: CacheEditor, tx: Row, sign: 1 | -1) {
  const amount = Number(tx.amount);
  const effect = tx.type === "TRANSFER" ? "transferOut" : tx.type === "INCOME" ? "income" : "expense";
  cache.update("account.list", (rows) =>
    rows.map((account) => {
      let delta = 0;
      if (account.id === tx.accountId) delta += accountDelta(account.type, effect, amount);
      if (tx.type === "TRANSFER" && account.id === tx.transferToAccountId) delta += accountDelta(account.type, "transferIn", amount);
      return delta === 0 ? account : { ...account, balance: asCached<typeof account.balance>(String(Number(account.balance) + sign * delta)) };
    }),
  );
}

/** Whether a row belongs in a copy of the list that was asked for with these filters. */
function matchesFilters(
  input: { accountId?: string; from?: unknown; to?: unknown; categoryIds?: string[]; minAmount?: number; maxAmount?: number },
  row: { accountId: string; transferToAccountId: string | null; date: Date; categoryId: string | null; type: string; amount: unknown },
) {
  if (input.accountId && row.accountId !== input.accountId && row.transferToAccountId !== input.accountId) return false;
  if (input.from && row.date < asDate(input.from)) return false;
  if (input.to && row.date > asDate(input.to)) return false;
  if (input.categoryIds?.length) {
    const wanted = input.categoryIds.filter((id) => id !== "none");
    const uncategorized = input.categoryIds.includes("none") && row.categoryId === null && row.type !== "TRANSFER";
    if (!(row.categoryId !== null && wanted.includes(row.categoryId)) && !uncategorized) return false;
  }
  const amount = Number(row.amount);
  if (input.minAmount !== undefined && amount < input.minAmount) return false;
  if (input.maxAmount !== undefined && amount > input.maxAmount) return false;
  return true;
}

/** Newest first, as the server lists them. */
const newestFirst = (a: { date: Date; createdAt: Date }, b: { date: Date; createdAt: Date }) =>
  b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime();

/** Adding and deleting a transaction, shared by the Transactions page and an account's page. */
export function useTransactionActions() {
  const utils = trpc.useUtils();
  const scope = (v: { id?: string }) => (v.id ? `transaction:${v.id}` : undefined);

  const createMutation = useOptimisticMutation("transaction.create", {
    lists: BALANCE_LISTS,
    scope,
    update: (v, cache) => {
      const accounts = utils.account.list.getData();
      const account = accounts?.find((a) => a.id === v.accountId);
      // Without the account at hand the row cannot be drawn; it appears with the refetch instead.
      if (!account) return;
      const isTransfer = v.type === "TRANSFER";
      const category = !isTransfer && v.categoryId ? (utils.category.list.getData()?.find((c) => c.id === v.categoryId) ?? null) : null;
      const row = {
        id: v.id ?? newId(),
        householdId: account.householdId,
        accountId: v.accountId,
        categoryId: category?.id ?? null,
        type: v.type,
        amount: asCached<(typeof account)["balance"]>(String(v.amount)),
        date: asDate(v.date),
        merchant: v.merchant,
        note: v.note ?? null,
        transferToAccountId: isTransfer ? (v.transferToAccountId ?? null) : null,
        counterpartyIban: null,
        counterpartyName: null,
        recurringItemId: null,
        recurringExcluded: false,
        createdAt: new Date(),
        category,
        account,
        transferToAccount: isTransfer ? (accounts?.find((a) => a.id === v.transferToAccountId) ?? null) : null,
      };
      cache.update("transaction.list", (rows, input) =>
        matchesFilters(input, row) ? [...rows, row].sort(newestFirst).slice(0, input.limit ?? 50) : rows,
      );
      moveBalances(cache, row, 1);
    },
  });
  const removeMutation = useOptimisticMutation("transaction.delete", {
    lists: [...BALANCE_LISTS, "recurring.list"],
    scope,
    update: (v, cache) => {
      const tx = cache.find("transaction.list", (row) => row.id === v.id);
      cache.update("transaction.list", (rows) => rows.filter((row) => row.id !== v.id));
      if (tx) moveBalances(cache, tx, -1);
    },
  });

  return {
    create: (values: Omit<Parameters<typeof createMutation.mutate>[0], "id">) => createMutation.mutate({ id: newId(), ...values }),
    remove: (id: string) => removeMutation.mutate({ id }),
  };
}

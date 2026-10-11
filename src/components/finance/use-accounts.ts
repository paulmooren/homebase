"use client";

import { normalizeIban } from "@/lib/csv";
import { useOptimisticMutation, asCached, type QueryPath } from "@/trpc/optimistic";

/** What changing or deleting a Financial account alters on screen. */
const ACCOUNT_LISTS = [
  "account.list",
  "transaction.list",
  "dashboard.summary",
  "dashboard.netWorthHistory",
  "dashboard.accountHistory",
  "dashboard.missingStatements",
] as const satisfies readonly QueryPath[];

/** What creating an account (which waits for the server) must refresh. */
export const AFTER_ACCOUNT_CREATED = ["account.list", "dashboard.summary", "dashboard.missingStatements"] as const satisfies readonly QueryPath[];

/** The two ways an IBAN can be refused, in the server's words, so the form can say so before anything is sent. */
export function ibanProblem(raw: string | null | undefined, others: { iban: string | null }[]) {
  if (!raw?.trim()) return null;
  const iban = normalizeIban(raw);
  if (!iban) return "That doesn't look like a valid IBAN.";
  if (others.some((a) => a.iban === iban)) return "Another account already has this IBAN.";
  return null;
}

/** Updating and deleting Financial accounts. Both show at once. */
export function useAccountActions() {
  const scope = (v: { id: string }) => `account:${v.id}`;

  const update = useOptimisticMutation("account.update", {
    lists: ACCOUNT_LISTS,
    scope,
    update: (v, cache) => {
      cache.update("account.list", (rows) =>
        rows.map((a) => {
          if (a.id !== v.id) return a;
          const next = {
            ...a,
            ...(v.name !== undefined ? { name: v.name } : {}),
            ...(v.institution !== undefined ? { institution: v.institution } : {}),
            ...(v.iban !== undefined ? { iban: v.iban ? normalizeIban(v.iban) : null } : {}),
            ...(v.type !== undefined ? { type: v.type } : {}),
            ...(v.ownerId !== undefined ? { ownerId: v.ownerId } : {}),
            ...(v.visibleToHousehold !== undefined ? { visibleToHousehold: v.visibleToHousehold } : {}),
          };
          if (v.startingBalance !== undefined) {
            // The balance is the starting balance plus the transactions, so it moves by the difference.
            const moved = v.startingBalance - Number(a.startingBalance);
            next.startingBalance = asCached<typeof a.startingBalance>(String(v.startingBalance));
            next.balance = asCached<typeof a.balance>(String(Number(a.balance) + moved));
          }
          return next;
        }),
      );
      // Transactions carry their account along (its name, its owner).
      cache.update("transaction.list", (rows) =>
        rows.map((t) => {
          const account = cache.find("account.list", (a) => a.id === t.accountId);
          return t.accountId === v.id && account ? { ...t, account } : t;
        }),
      );
    },
  });

  const remove = useOptimisticMutation("account.delete", {
    lists: [...ACCOUNT_LISTS, "recurring.list"],
    scope,
    update: (v, cache) => {
      cache.update("account.list", (rows) => rows.filter((a) => a.id !== v.id));
      // Its transactions go with it; a transfer into it stays, without a destination.
      cache.update("transaction.list", (rows) =>
        rows
          .filter((t) => t.accountId !== v.id)
          .map((t) => (t.transferToAccountId === v.id ? { ...t, transferToAccountId: null, transferToAccount: null } : t)),
      );
    },
  });

  return { update, remove };
}

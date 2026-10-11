"use client";

import { amountForBasis, reviewAmount } from "@/lib/budget-basis";
import { newId } from "@/lib/client-id";
import { nextOccurrence } from "@/lib/recurring";
import { applyMove, applyReorder } from "@/lib/recurring-order";
import { trpc } from "@/trpc/react";
import { useOptimisticMutation, type CacheEditor, type QueryPath } from "@/trpc/optimistic";

/** What a change to a Recurring item alters on screen: the Budget view, the Transactions' recurring marks, the suggestions. */
const ITEM_LISTS = ["recurring.list", "recurring.suggestions", "transaction.list"] as const satisfies readonly QueryPath[];

const itemScope = (v: { id?: string }) => (v.id ? `recurring:${v.id}` : undefined);
const groupScope = (id: string | null | undefined) => (id ? `budget-group:${id}` : undefined);

/**
 * The Recurring-item mutations of the Budgets page, the "mark as recurring" form and the payment history panel
 * (which passes the item it shows, so setting a payment aside can work out the item's figures again).
 */
export function useRecurringActions(historyOfItem?: string) {
  const utils = trpc.useUtils();

  const accountOwner = (accountId: string | null | undefined) =>
    accountId ? utils.account.list.getData()?.find((a) => a.id === accountId) : undefined;
  const categoryOf = (id: string | null | undefined) => (id ? (utils.category.list.getData()?.find((c) => c.id === id) ?? null) : null);

  /** The group an item ends up in, adding a brand-new one to the cached groups (the same name reuses the existing one). */
  const resolveGroup = (
    cache: CacheEditor,
    type: string,
    v: { budgetGroupId?: string | null; newGroupName?: string; newGroupId?: string },
  ): string | null | undefined => {
    if (type === "INCOME") return null;
    if (v.newGroupName) {
      const existing = utils.budgetGroup.list.getData()?.find((g) => g.name === v.newGroupName);
      if (existing) return existing.id;
      const id = v.newGroupId ?? newId();
      cache.update("budgetGroup.list", (rows) => [...rows, { id, name: v.newGroupName! }]);
      return id;
    }
    return v.budgetGroupId;
  };

  const create = useOptimisticMutation("recurring.create", {
    lists: [...ITEM_LISTS, "budgetGroup.list"],
    scope: itemScope,
    dependsOn: (v) => [groupScope(v.budgetGroupId), groupScope(v.newGroupId)],
    update: (v, cache) => {
      const linked = accountOwner(v.accountId);
      const budgetGroupId = resolveGroup(cache, v.type, v) ?? null;
      const lastSeenAt = v.lastDate ? new Date(v.lastDate as Date) : new Date();
      const rows = utils.recurring.list.getData() ?? [];
      const sortOrder = Math.max(0, ...rows.map((r) => r.sortOrder)) + 1;
      cache.update("recurring.list", (items) => [
        ...items,
        {
          id: v.id ?? newId(),
          householdId: linked?.householdId ?? utils.household.current.getData()?.id ?? "",
          budgetGroupId,
          ownerId: linked ? linked.ownerId : (v.ownerId ?? null),
          accountId: linked?.id ?? null,
          toAccountId: v.type === "TRANSFER" ? (v.toAccountId ?? null) : null,
          visibleToHousehold: v.visibleToHousehold ?? true,
          name: v.name,
          sortOrder,
          type: v.type,
          amount: v.amount,
          frequency: null,
          amountVaries: v.amountVaries ?? false,
          basis: v.fromTransactionId ? ("LATEST" as const) : ("FIXED" as const),
          keptAmount: null,
          intervalCount: v.intervalCount ?? 1,
          intervalUnit: v.intervalUnit ?? "MONTH",
          categoryId: v.categoryId ?? null,
          matchIban: null,
          matchText: null,
          matchRef: null,
          matchKey: null,
          source: "MANUAL" as const,
          detectedName: null,
          status: "ACTIVE" as const,
          lastSeenAt,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: categoryOf(v.categoryId),
          paymentCount: 0,
          proposal: null,
          drift: null,
          nextDueDate: nextOccurrence(lastSeenAt, v.intervalCount ?? 1, v.intervalUnit ?? "MONTH"),
        },
      ]);
    },
  });

  const update = useOptimisticMutation("recurring.update", {
    lists: [...ITEM_LISTS, "budgetGroup.list"],
    scope: itemScope,
    dependsOn: (v) => [groupScope(v.budgetGroupId), groupScope(v.newGroupId)],
    update: (v, cache) => {
      const current = utils.recurring.list.getData()?.find((i) => i.id === v.id);
      if (!current) return;
      const budgetGroupId = resolveGroup(cache, current.type, v);
      const linked = v.accountId ? accountOwner(v.accountId) : undefined;
      cache.update("recurring.list", (items) =>
        items.flatMap((item) => {
          if (item.id !== v.id) return [item];
          if (v.status === "CANCELLED") return [];
          const intervalCount = v.intervalCount ?? item.intervalCount;
          const intervalUnit = v.intervalUnit ?? item.intervalUnit;
          const next = {
            ...item,
            ...(v.name !== undefined ? { name: v.name } : {}),
            ...(v.amountVaries !== undefined ? { amountVaries: v.amountVaries } : {}),
            ...(v.toAccountId !== undefined ? { toAccountId: v.toAccountId } : {}),
            ...(v.visibleToHousehold !== undefined ? { visibleToHousehold: v.visibleToHousehold } : {}),
            ...(budgetGroupId !== undefined ? { budgetGroupId } : {}),
            intervalCount,
            intervalUnit,
            nextDueDate: item.lastSeenAt ? nextOccurrence(new Date(item.lastSeenAt), intervalCount, intervalUnit) : null,
          };
          if (v.categoryId !== undefined) Object.assign(next, { categoryId: v.categoryId, category: categoryOf(v.categoryId) });
          // Linking to an account moves the item to that account's owner; unlinking leaves the owner as it was.
          if (v.ownerId !== undefined) next.ownerId = v.ownerId;
          if (linked) Object.assign(next, { accountId: linked.id, ownerId: linked.ownerId });
          else if (v.accountId === null) next.accountId = null;
          // Typing an amount means "use this one".
          if (v.amount !== undefined) Object.assign(next, { amount: v.amount, basis: "FIXED" as const, keptAmount: null, proposal: null, drift: null });
          return [next];
        }),
      );
    },
  });

  const remove = useOptimisticMutation("recurring.delete", {
    lists: ITEM_LISTS,
    scope: itemScope,
    update: (v, cache) => {
      cache.update("recurring.list", (items) => items.filter((i) => i.id !== v.id));
      // Its payments stop belonging to it.
      cache.update("transaction.list", (rows) =>
        rows.map((t) => (t.recurringItemId === v.id ? { ...t, recurringItemId: null, recurringExcluded: false } : t)),
      );
    },
  });

  // A drop shows at once; the server confirms, or the list goes back to how it was.
  const reorder = useOptimisticMutation("recurring.reorder", {
    lists: ["recurring.list"],
    scope: () => "recurring-order",
    dependsOn: (v) => [...v.ids.map((id) => `recurring:${id}`), groupScope(v.move?.groupId)],
    update: (v, cache) =>
      cache.update("recurring.list", (items) => (v.move ? applyMove(items, v.ids, v.move) : applyReorder(items, v.ids))),
  });

  // "Update": take the proposed amount. "Keep": stay on the current one and stop asking about this figure.
  const acceptProposal = useOptimisticMutation("recurring.acceptProposal", {
    lists: ["recurring.list"],
    scope: itemScope,
    update: (v, cache) =>
      cache.update("recurring.list", (items) =>
        items.map((i) => (i.id === v.id && i.proposal !== null ? { ...i, amount: i.proposal, keptAmount: null, proposal: null } : i)),
      ),
  });
  const keepAmount = useOptimisticMutation("recurring.keepAmount", {
    lists: ["recurring.list"],
    scope: itemScope,
    update: (v, cache) =>
      cache.update("recurring.list", (items) =>
        items.map((i) => (i.id === v.id && i.proposal !== null ? { ...i, keptAmount: i.proposal, proposal: null } : i)),
      ),
  });

  // Choosing how the Budgeted amount is taken (history panel). A derived basis takes its figure from the payments now.
  const setBasis = useOptimisticMutation("recurring.setBasis", {
    lists: ["recurring.list", "recurring.history"],
    scope: itemScope,
    update: (v, cache) => {
      const history = utils.recurring.history.getData({ id: v.id });
      const counted = (history?.payments ?? []).filter((p) => !p.excluded).map((p) => p.amount);
      const amount = v.basis === "FIXED" ? v.amount : (amountForBasis(v.basis, counted) ?? undefined);
      if (amount === undefined) return;
      cache.update("recurring.list", (items) =>
        items.map((i) => (i.id === v.id ? { ...i, basis: v.basis, amount, keptAmount: null, proposal: null, drift: null } : i)),
      );
      cache.update("recurring.history", (h, input) => (input.id === v.id ? { ...h, basis: v.basis, amount } : h));
    },
  });

  // Setting a one-off payment aside (or taking it back): the figures that follow from the payments are worked out again.
  const setPaymentExcluded = useOptimisticMutation("recurring.setPaymentExcluded", {
    lists: ["recurring.list", "recurring.history", "transaction.list"],
    scope: (v) => `transaction:${v.transactionId}`,
    update: (v, cache) => {
      cache.update("transaction.list", (rows) =>
        rows.map((t) => (t.id === v.transactionId ? { ...t, recurringExcluded: v.excluded } : t)),
      );
      const itemId = historyOfItem ?? cache.find("transaction.list", (t) => t.id === v.transactionId)?.recurringItemId;
      const history = itemId ? utils.recurring.history.getData({ id: itemId }) : undefined;
      if (!history) return;
      const payments = history.payments.map((p) => (p.id === v.transactionId ? { ...p, excluded: v.excluded } : p));
      const counted = payments.filter((p) => !p.excluded).map((p) => p.amount);
      cache.update("recurring.history", (h) => (h.id === history.id ? { ...h, payments } : h));
      cache.update("recurring.list", (items) =>
        items.map((i) =>
          i.id === history.id
            ? { ...i, paymentCount: counted.length, ...reviewAmount({ basis: i.basis, amount: i.amount, keptAmount: i.keptAmount, payments: counted }) }
            : i,
        ),
      );
    },
  });

  return {
    create: (values: Omit<Parameters<typeof create.mutate>[0], "id" | "newGroupId">, callbacks?: Parameters<typeof create.mutate>[1]) =>
      create.mutate({ id: newId(), ...(values.newGroupName ? { newGroupId: newId() } : {}), ...values }, callbacks),
    update: (values: Omit<Parameters<typeof update.mutate>[0], "newGroupId">) =>
      update.mutate({ ...(values.newGroupName ? { newGroupId: newId() } : {}), ...values }),
    remove: remove.mutate,
    reorder: reorder.mutate,
    acceptProposal: acceptProposal.mutate,
    keepAmount: keepAmount.mutate,
    setBasis,
    setPaymentExcluded,
  };
}

/** Creating, renaming and deleting Budget groups. */
export function useBudgetGroupActions() {
  const lists = ["budgetGroup.list", "recurring.list"] as const;
  const scope = (v: { id?: string }) => groupScope(v.id);

  const create = useOptimisticMutation("budgetGroup.create", {
    lists,
    scope,
    update: (v, cache) => cache.update("budgetGroup.list", (rows) => [...rows, { id: v.id ?? newId(), name: v.name }]),
  });
  const rename = useOptimisticMutation("budgetGroup.rename", {
    lists,
    scope,
    update: (v, cache) => cache.update("budgetGroup.list", (rows) => rows.map((g) => (g.id === v.id ? { ...g, name: v.name } : g))),
  });
  // Deleting a group never deletes its items: they go back to "Other".
  const remove = useOptimisticMutation("budgetGroup.delete", {
    lists,
    scope,
    update: (v, cache) => {
      cache.update("budgetGroup.list", (rows) => rows.filter((g) => g.id !== v.id));
      cache.update("recurring.list", (items) => items.map((i) => (i.budgetGroupId === v.id ? { ...i, budgetGroupId: null } : i)));
    },
  });

  return {
    create: (name: string) => create.mutate({ id: newId(), name }),
    rename: (id: string, name: string) => rename.mutate({ id, name }),
    remove: (id: string) => remove.mutate({ id }),
  };
}

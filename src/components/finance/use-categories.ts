"use client";

import { newId } from "@/lib/client-id";
import { trpc } from "@/trpc/react";
import { useOptimisticMutation, type QueryPath } from "@/trpc/optimistic";

/** Other screens that show a Category's name and colour. */
const SHOWN_ELSEWHERE = ["transaction.list", "recurring.list", "budget.list"] as const satisfies readonly QueryPath[];

/** Creating, changing and deleting Categories. All show at once. */
export function useCategoryActions() {
  const utils = trpc.useUtils();
  const scope = (v: { id?: string }) => (v.id ? `category:${v.id}` : undefined);

  const create = useOptimisticMutation("category.create", {
    lists: ["category.list"],
    scope,
    update: (v, cache) =>
      cache.update("category.list", (rows) =>
        [
          ...rows,
          {
            id: v.id ?? newId(),
            householdId: utils.household.current.getData()?.id ?? "",
            name: v.name,
            color: v.color,
            createdAt: new Date(),
          },
        ].sort((a, b) => a.name.localeCompare(b.name)),
      ),
  });
  const update = useOptimisticMutation("category.update", {
    lists: ["category.list", ...SHOWN_ELSEWHERE],
    scope,
    update: (v, cache) => {
      const patch = { ...(v.name !== undefined ? { name: v.name } : {}), ...(v.color !== undefined ? { color: v.color } : {}) };
      cache.update("category.list", (rows) =>
        rows.map((c) => (c.id === v.id ? { ...c, ...patch } : c)).sort((a, b) => a.name.localeCompare(b.name)),
      );
      cache.update("transaction.list", (rows) =>
        rows.map((t) => (t.categoryId === v.id && t.category ? { ...t, category: { ...t.category, ...patch } } : t)),
      );
      cache.update("recurring.list", (rows) =>
        rows.map((i) => (i.categoryId === v.id && i.category ? { ...i, category: { ...i.category, ...patch } } : i)),
      );
    },
  });
  const remove = useOptimisticMutation("category.delete", {
    lists: ["category.list", ...SHOWN_ELSEWHERE],
    scope,
    update: (v, cache) => {
      cache.update("category.list", (rows) => rows.filter((c) => c.id !== v.id));
      // What used it is left without a category.
      cache.update("transaction.list", (rows) => rows.map((t) => (t.categoryId === v.id ? { ...t, categoryId: null, category: null } : t)));
      cache.update("recurring.list", (rows) => rows.map((i) => (i.categoryId === v.id ? { ...i, categoryId: null, category: null } : i)));
    },
  });

  return {
    create: (values: { name: string; color: string }) => create.mutate({ id: newId(), ...values }),
    update: update.mutate,
    remove: remove.mutate,
  };
}

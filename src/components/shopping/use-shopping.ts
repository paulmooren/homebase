"use client";

import { useEffect, useRef, useState } from "react";

import { newId } from "@/lib/client-id";
import { trpc } from "@/trpc/react";
import { hasPendingChanges, useOptimisticMutation, type CacheEditor } from "@/trpc/optimistic";

/** How often an open list re-checks for items your housemate added from their phone. */
export const SHOPPING_REFRESH_MS = 5000;

/** How long a ticked item stays on screen, struck through, before it disappears — time to undo a mis-tap. */
export const TICK_GRACE_MS = 4000;

/**
 * Tracks items that were just ticked: they stay visible (and untickable) for
 * TICK_GRACE_MS, then drop off the list. Unticking cancels the countdown.
 */
export function useTickGrace() {
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const forget = (id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setLeaving((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const start = (id: string) => {
    clearTimeout(timers.current.get(id));
    setLeaving((prev) => new Set(prev).add(id));
    timers.current.set(
      id,
      setTimeout(() => forget(id), TICK_GRACE_MS),
    );
  };

  return { leaving, start, cancel: forget };
}

/** Items of one list, kept fresh while it is on screen. */
export function useShoppingItems(listId: string | undefined) {
  return trpc.shopping.items.useQuery(
    { listId: listId ?? "" },
    {
      enabled: !!listId,
      // Not while a change is still being saved: a refetch landing now would bring the old list back for a moment.
      refetchInterval: () => (hasPendingChanges("shopping.items") ? false : SHOPPING_REFRESH_MS),
    },
  );
}

/** Favorites of one list. */
export function useShoppingFavorites(listId: string | undefined) {
  return trpc.shopping.favorites.useQuery({ listId: listId ?? "" }, { enabled: !!listId });
}

const itemScope = (v: { id?: string }) => (v.id ? `shopping-item:${v.id}` : undefined);
const listScope = (id: string) => `shopping-list:${id}`;

/**
 * Mutations for one list. Everything shows at once and saves behind the scenes, which matters in a shop.
 * The open count on the list buttons (and the dashboard card) follows the items.
 */
export function useShoppingActions(listId: string | undefined) {
  const utils = trpc.useUtils();
  const lists = ["shopping.items", "shopping.lists"] as const;
  const favoriteLists = ["shopping.favorites"] as const;

  /** Moves the "open items" figure of a list; ticked items no longer count. */
  const countOpen = (cache: CacheEditor, id: string, delta: number) =>
    cache.update("shopping.lists", (rows) =>
      rows.map((l) => (l.id === id ? { ...l, openCount: Math.max(0, l.openCount + delta) } : l)),
    );
  const itemNow = (itemId: string) => (listId ? utils.shopping.items.getData({ listId })?.find((i) => i.id === itemId) : undefined);

  const addItem = useOptimisticMutation("shopping.addItem", {
    lists,
    scope: itemScope,
    dependsOn: (v) => [listScope(v.listId)],
    update: (v, cache) => {
      const me = utils.user.me.getData();
      cache.update("shopping.items", (rows, input) =>
        input.listId !== v.listId
          ? rows
          : [
              ...rows,
              {
                id: v.id ?? newId(),
                listId: v.listId,
                name: v.name,
                note: v.note || null,
                quantity: v.quantity || null,
                checkedAt: null,
                clearedAt: null,
                addedById: me?.id ?? null,
                createdAt: new Date(),
                addedBy: me ? { id: me.id, name: me.name, email: me.email } : null,
              },
            ],
      );
      countOpen(cache, v.listId, 1);
    },
  });
  const updateItem = useOptimisticMutation("shopping.updateItem", {
    lists: ["shopping.items"],
    scope: itemScope,
    update: (v, cache) =>
      cache.update("shopping.items", (rows) =>
        rows.map((item) =>
          item.id === v.id
            ? {
                ...item,
                ...(v.name !== undefined ? { name: v.name } : {}),
                ...(v.quantity !== undefined ? { quantity: v.quantity || null } : {}),
                ...(v.note !== undefined ? { note: v.note || null } : {}),
              }
            : item,
        ),
      ),
  });
  const deleteItem = useOptimisticMutation("shopping.deleteItem", {
    lists,
    scope: itemScope,
    update: (v, cache) => {
      const item = itemNow(v.id);
      cache.update("shopping.items", (rows) => rows.filter((row) => row.id !== v.id));
      if (item && !item.checkedAt) countOpen(cache, item.listId, -1);
    },
  });
  const setChecked = useOptimisticMutation("shopping.setChecked", {
    lists,
    scope: itemScope,
    update: (v, cache) => {
      const item = itemNow(v.id);
      cache.update("shopping.items", (rows) =>
        rows.map((row) => (row.id === v.id ? { ...row, checkedAt: v.checked ? new Date() : null } : row)),
      );
      if (item && !!item.checkedAt !== v.checked) countOpen(cache, item.listId, v.checked ? -1 : 1);
    },
  });

  const addFavorite = useOptimisticMutation("shopping.addFavorite", {
    lists: favoriteLists,
    scope: (v) => (v.id ? `shopping-favorite:${v.id}` : undefined),
    dependsOn: (v) => [listScope(v.listId)],
    update: (v, cache) =>
      cache.update("shopping.favorites", (rows, input) =>
        input.listId !== v.listId
          ? rows
          : [...rows, { id: v.id ?? newId(), listId: v.listId, name: v.name, quantity: null, createdAt: new Date() }],
      ),
  });
  const removeFavorite = useOptimisticMutation("shopping.removeFavorite", {
    lists: favoriteLists,
    scope: (v) => `shopping-favorite:${v.id}`,
    update: (v, cache) => cache.update("shopping.favorites", (rows) => rows.filter((f) => f.id !== v.id)),
  });
  const updateFavorite = useOptimisticMutation("shopping.updateFavorite", {
    lists: favoriteLists,
    scope: (v) => `shopping-favorite:${v.id}`,
    update: (v, cache) =>
      cache.update("shopping.favorites", (rows) => rows.map((f) => (f.id === v.id ? { ...f, name: v.name } : f))),
  });

  return {
    addItem: { mutate: (v: { listId: string; name: string; quantity?: string | null }) => addItem.mutate({ id: newId(), ...v }) },
    updateItem,
    deleteItem,
    setChecked,
    addFavorite: { mutate: (v: { listId: string; name: string }) => addFavorite.mutate({ id: newId(), ...v }) },
    removeFavorite,
    updateFavorite,
  };
}

/** Mutations on the lists themselves (create, rename, delete), shared by the page. */
export function useShoppingListActions(handlers: { onDeleteUndone: (listId: string) => void }) {
  const utils = trpc.useUtils();
  const lists = ["shopping.lists"] as const;
  const scope = (v: { id?: string }) => (v.id ? listScope(v.id) : undefined);

  const create = useOptimisticMutation("shopping.createList", {
    // The new list's items and favorites are named too: they are frozen (no poll asks the server for a list it
    // has not heard of yet) and loaded once the list exists.
    lists: [...lists, "shopping.items", "shopping.favorites"],
    scope,
    update: (v, cache) => {
      const me = utils.user.me.getData();
      // A new list starts empty, so items can be added to it straight away.
      if (v.id) {
        utils.shopping.items.setData({ listId: v.id }, []);
        utils.shopping.favorites.setData({ listId: v.id }, []);
      }
      cache.update("shopping.lists", (rows) => [
        ...rows,
        {
          id: v.id ?? newId(),
          householdId: utils.household.current.getData()?.id ?? "",
          ownerId: v.shared ? null : (me?.id ?? null),
          name: v.name,
          createdAt: new Date(),
          updatedAt: new Date(),
          openCount: 0,
        },
      ]);
    },
  });
  const rename = useOptimisticMutation("shopping.renameList", {
    lists,
    scope,
    update: (v, cache) =>
      cache.update("shopping.lists", (rows) => rows.map((l) => (l.id === v.id ? { ...l, name: v.name } : l))),
  });
  const remove = useOptimisticMutation("shopping.deleteList", {
    lists,
    scope,
    update: (v, cache) => cache.update("shopping.lists", (rows) => rows.filter((l) => l.id !== v.id)),
    onUndone: (v) => handlers.onDeleteUndone(v.id),
  });

  return {
    create: (v: { name: string; shared: boolean }) => {
      const id = newId();
      create.mutate({ id, ...v });
      return id;
    },
    rename: rename.mutate,
    remove: remove.mutate,
  };
}

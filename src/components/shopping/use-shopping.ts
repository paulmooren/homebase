"use client";

import { useEffect, useRef, useState } from "react";

import { trpc } from "@/trpc/react";

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
    { enabled: !!listId, refetchInterval: SHOPPING_REFRESH_MS },
  );
}

/** Favorites of one list. */
export function useShoppingFavorites(listId: string | undefined) {
  return trpc.shopping.favorites.useQuery({ listId: listId ?? "" }, { enabled: !!listId });
}

/** Mutations for one list. Ticking is optimistic so it feels instant in a shop. */
export function useShoppingActions(listId: string | undefined) {
  const utils = trpc.useUtils();
  const refresh = () => {
    utils.shopping.items.invalidate();
    utils.shopping.lists.invalidate();
  };

  // Adding and editing show up at once; the refetch afterwards swaps in the real rows.
  const addItem = trpc.shopping.addItem.useMutation({
    onMutate: async (input) => {
      if (!listId) return {};
      await utils.shopping.items.cancel({ listId });
      const previous = utils.shopping.items.getData({ listId });
      utils.shopping.items.setData({ listId }, (old) => [
        ...(old ?? []),
        {
          id: `pending-${Date.now()}`,
          listId,
          name: input.name,
          note: null,
          quantity: input.quantity ?? null,
          checkedAt: null,
          clearedAt: null,
          addedById: null,
          createdAt: new Date(),
          addedBy: null,
        },
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (listId && context?.previous) utils.shopping.items.setData({ listId }, context.previous);
    },
    onSettled: refresh,
  });
  const updateItem = trpc.shopping.updateItem.useMutation({
    onMutate: async (input) => {
      if (!listId) return {};
      await utils.shopping.items.cancel({ listId });
      const previous = utils.shopping.items.getData({ listId });
      utils.shopping.items.setData({ listId }, (old) =>
        old?.map((item) =>
          item.id === input.id
            ? {
                ...item,
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.quantity !== undefined ? { quantity: input.quantity || null } : {}),
                ...(input.note !== undefined ? { note: input.note || null } : {}),
              }
            : item,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (listId && context?.previous) utils.shopping.items.setData({ listId }, context.previous);
    },
    onSettled: refresh,
  });
  const deleteItem = trpc.shopping.deleteItem.useMutation({ onSuccess: refresh });
  const refreshFavorites = () => utils.shopping.favorites.invalidate();
  const addFavorite = trpc.shopping.addFavorite.useMutation({ onSuccess: refreshFavorites });
  const removeFavorite = trpc.shopping.removeFavorite.useMutation({ onSuccess: refreshFavorites });
  const updateFavorite = trpc.shopping.updateFavorite.useMutation({
    onMutate: async ({ id, name }) => {
      if (!listId) return {};
      await utils.shopping.favorites.cancel({ listId });
      const previous = utils.shopping.favorites.getData({ listId });
      utils.shopping.favorites.setData({ listId }, (old) => old?.map((f) => (f.id === id ? { ...f, name } : f)));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (listId && context?.previous) utils.shopping.favorites.setData({ listId }, context.previous);
    },
    onSettled: refreshFavorites,
  });
  const setChecked = trpc.shopping.setChecked.useMutation({
    onMutate: async ({ id, checked }) => {
      if (!listId) return {};
      await utils.shopping.items.cancel({ listId });
      const previous = utils.shopping.items.getData({ listId });
      utils.shopping.items.setData({ listId }, (old) =>
        old?.map((item) => (item.id === id ? { ...item, checkedAt: checked ? new Date() : null } : item)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (listId && context?.previous) utils.shopping.items.setData({ listId }, context.previous);
    },
    onSettled: refresh,
  });

  return { addItem, updateItem, deleteItem, setChecked, addFavorite, removeFavorite, updateFavorite };
}

"use client";

import { trpc } from "@/trpc/react";

/** How often an open list re-checks for items your housemate added from their phone. */
export const SHOPPING_REFRESH_MS = 5000;

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

  const addItem = trpc.shopping.addItem.useMutation({ onSuccess: refresh });
  const updateItem = trpc.shopping.updateItem.useMutation({ onSuccess: refresh });
  const deleteItem = trpc.shopping.deleteItem.useMutation({ onSuccess: refresh });
  const clearChecked = trpc.shopping.clearChecked.useMutation({ onSuccess: refresh });
  const refreshFavorites = () => utils.shopping.favorites.invalidate();
  const addFavorite = trpc.shopping.addFavorite.useMutation({ onSuccess: refreshFavorites });
  const removeFavorite = trpc.shopping.removeFavorite.useMutation({ onSuccess: refreshFavorites });
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

  return { addItem, updateItem, deleteItem, clearChecked, setChecked, addFavorite, removeFavorite };
}

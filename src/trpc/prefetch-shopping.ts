import { caller, loadQuery } from "@/trpc/server";

/**
 * Loads the shopping lists and then the items of the list the screen opens on — the second step needs the first's
 * answer, which in the browser was a second round trip after the page had loaded.
 * `"page"`: the Shopping page opens on the first list (and shows its Favorites); `"dashboard"`: the card shows the
 * first Shared list. These mirror how each screen picks its list.
 */
export async function loadShoppingList(screen: "dashboard" | "page") {
  const lists = await loadQuery("shopping.lists", undefined, () => caller.shopping.lists());
  if (!lists?.length) return;

  const { id: listId } = screen === "dashboard" ? (lists.find((l) => l.ownerId === null) ?? lists[0]) : lists[0];
  await Promise.all([
    loadQuery("shopping.items", { listId }, () => caller.shopping.items({ listId })),
    screen === "page" && loadQuery("shopping.favorites", { listId }, () => caller.shopping.favorites({ listId })),
  ]);
}

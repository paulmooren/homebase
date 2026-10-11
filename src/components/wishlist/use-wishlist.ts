"use client";

import { newId } from "@/lib/client-id";
import { trpc } from "@/trpc/react";
import { useOptimisticMutation } from "@/trpc/optimistic";

/** The server accepts "example.com/x" as a link; the screen shows it the way it will be stored. */
const asLink = (value: string | null | undefined) => {
  const link = value?.trim();
  if (!link) return null;
  return /^[a-z][a-z0-9+.-]*:/i.test(link) ? link : `https://${link}`;
};

/** Wishlist mutations. Every change shows at once; claiming a wish someone else got first is undone with a message. */
export function useWishlistActions() {
  const utils = trpc.useUtils();
  const lists = ["wishlist.list"] as const;
  const scope = (v: { id?: string }) => (v.id ? `wish:${v.id}` : undefined);
  const me = () => utils.user.me.getData();

  const add = useOptimisticMutation("wishlist.add", {
    lists,
    scope,
    update: (v, cache) => {
      const owner = v.home ? null : (me()?.id ?? null);
      const wish = {
        id: v.id ?? newId(),
        householdId: utils.household.current.getData()?.id ?? "",
        ownerId: owner,
        title: v.title,
        url: asLink(v.url),
        price: v.price ?? null,
        note: v.note?.trim() || null,
        claimedById: null,
        receivedAt: null,
        createdAt: new Date(),
        claimedBy: null,
        claimedByMe: false,
      };
      // Newest first.
      cache.update("wishlist.list", (rows, input) => (input.ownerId === owner ? [wish, ...rows] : rows));
    },
  });
  const update = useOptimisticMutation("wishlist.update", {
    lists,
    scope,
    update: (v, cache) =>
      cache.update("wishlist.list", (rows) =>
        rows.map((w) =>
          w.id === v.id ? { ...w, title: v.title, url: asLink(v.url), price: v.price ?? null, note: v.note?.trim() || null } : w,
        ),
      ),
  });
  const remove = useOptimisticMutation("wishlist.delete", {
    lists,
    scope,
    update: (v, cache) => cache.update("wishlist.list", (rows) => rows.filter((w) => w.id !== v.id)),
  });
  const setReceived = useOptimisticMutation("wishlist.setReceived", {
    lists,
    scope,
    update: (v, cache) =>
      cache.update("wishlist.list", (rows) =>
        rows.map((w) => (w.id === v.id ? { ...w, receivedAt: v.received ? new Date() : null } : w)),
      ),
  });
  const claim = useOptimisticMutation("wishlist.claim", {
    lists,
    scope,
    update: (v, cache) => {
      const user = me();
      cache.update("wishlist.list", (rows) =>
        rows.map((w) =>
          w.id === v.id && user
            ? { ...w, claimedById: user.id, claimedBy: { id: user.id, name: user.name, email: user.email }, claimedByMe: true }
            : w,
        ),
      );
    },
  });
  const unclaim = useOptimisticMutation("wishlist.unclaim", {
    lists,
    scope,
    update: (v, cache) =>
      cache.update("wishlist.list", (rows) =>
        rows.map((w) => (w.id === v.id && w.claimedByMe ? { ...w, claimedById: null, claimedBy: null, claimedByMe: false } : w)),
      ),
  });
  // Showing or hiding your whole wishlist is a flag on your membership.
  const setVisibility = useOptimisticMutation("wishlist.setVisibility", {
    lists: ["household.current"],
    scope: () => "wishlist-visibility",
    update: (v, cache) =>
      cache.update("household.current", (household) =>
        household
          ? { ...household, members: household.members.map((m) => (m.user.id === me()?.id ? { ...m, wishlistVisible: v.visible } : m)) }
          : household,
      ),
  });

  return {
    add: (values: { home: boolean; title: string; url: string | null; price: number | null; note: string | null }) =>
      add.mutate({ id: newId(), ...values }),
    update: update.mutate,
    remove: remove.mutate,
    setReceived: setReceived.mutate,
    claim: claim.mutate,
    unclaim: unclaim.mutate,
    setVisibility: setVisibility.mutate,
  };
}

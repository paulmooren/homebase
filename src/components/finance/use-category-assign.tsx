"use client";

import { useState } from "react";
import { Button } from "@base-ui/react/button";

import { trpc } from "@/trpc/react";
import { useOptimisticMutation } from "@/trpc/optimistic";
import { Toast, toastPrimary, toastSecondary } from "@/components/toast";
import type { Category } from "@/components/finance/category-cell";

/** Merchant text as the server compares it: ignoring case, surrounding spaces and repeated spaces. */
const sameText = (merchant: string) => merchant.trim().replace(/\s+/g, " ").toLowerCase();

type Prompt = { id: string; categoryId: string; merchant: string; count: number };

/**
 * Setting a category on a transaction, plus the follow-up offer: when other
 * transactions have exactly the same merchant text and no category yet, ask
 * whether to give them this category too. `toast` is the offer — render it
 * once on the page.
 */
export function useCategoryAssign(categories: Category[]) {
  const utils = trpc.useUtils();
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  const categoryOf = (id: string | null) => (id ? (utils.category.list.getData()?.find((c) => c.id === id) ?? null) : null);

  const update = useOptimisticMutation("transaction.update", {
    lists: ["transaction.list", "budget.list"],
    scope: (v) => `transaction:${v.id}`,
    update: (v, cache) => {
      const category = categoryOf(v.categoryId);
      cache.update("transaction.list", (rows) =>
        rows.map((row) => (row.id === v.id ? { ...row, categoryId: category?.id ?? null, category } : row)),
      );
    },
  });
  const apply = useOptimisticMutation("transaction.applyCategoryToSame", {
    lists: ["transaction.list", "budget.list"],
    scope: (v) => `transaction:${v.id}`,
    update: (v, cache) => {
      const source = cache.find("transaction.list", (row) => row.id === v.id);
      if (!source) return;
      const category = categoryOf(v.categoryId);
      const same = sameText(source.merchant);
      // The same rule as the server: other uncategorized, non-transfer rows with this merchant text, on accounts you can edit.
      cache.update("transaction.list", (rows) =>
        rows.map((row) =>
          row.id !== v.id && row.categoryId === null && row.type !== "TRANSFER" && sameText(row.merchant) === same && canEdit(row.account.ownerId)
            ? { ...row, categoryId: category?.id ?? null, category }
            : row,
        ),
      );
    },
  });
  const canEdit = (ownerId: string | null) => ownerId === null || ownerId === utils.user.me.getData()?.id;

  async function assign(id: string, categoryId: string | null) {
    setPrompt(null);
    const saved = update.mutateAsync({ id, categoryId }).then(
      () => true,
      () => false,
    );
    if (!categoryId) {
      await saved;
      return;
    }
    // The count of look-alikes does not depend on this save, so it is asked for at the same time.
    const sameAsked = utils.transaction.sameMerchant.fetch({ id }, { staleTime: 0 }).catch(() => null);
    const [ok, same] = await Promise.all([saved, sameAsked]);
    if (ok && same && same.count > 0) setPrompt({ id, categoryId, merchant: same.merchant, count: same.count });
  }

  const category = categories.find((c) => c.id === prompt?.categoryId);

  const toast = prompt && (
    <Toast
      onClose={() => setPrompt(null)}
      actions={
        <>
          <Button
            type="button"
            onClick={() => {
              apply.mutate({ id: prompt.id, categoryId: prompt.categoryId });
              setPrompt(null);
            }}
            className={toastPrimary}
          >
            Yes, apply to {prompt.count === 1 ? "it" : `all ${prompt.count}`}
          </Button>
          <Button type="button" onClick={() => setPrompt(null)} className={toastSecondary}>
            No thanks
          </Button>
        </>
      }
    >
      <p>
        Also set{" "}
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <span className="block h-2 w-2 rounded-full" style={{ background: category?.color ?? "#c7c9cf" }} />
          {category?.name ?? "this category"}
        </span>{" "}
        for {prompt.count} other &ldquo;{prompt.merchant}&rdquo; transaction{prompt.count === 1 ? "" : "s"} without a
        category?
      </p>
    </Toast>
  );

  return { assign, toast };
}

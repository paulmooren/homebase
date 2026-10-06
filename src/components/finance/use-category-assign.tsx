"use client";

import { useState } from "react";

import { trpc } from "@/trpc/react";
import { Toast, toastPrimary, toastSecondary } from "@/components/toast";
import type { Category } from "@/components/finance/category-cell";

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

  const update = trpc.transaction.update.useMutation();
  const apply = trpc.transaction.applyCategoryToSame.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.budget.list.invalidate();
    },
  });

  async function assign(id: string, categoryId: string | null) {
    setPrompt(null);
    await update.mutateAsync({ id, categoryId });
    utils.transaction.list.invalidate();
    if (!categoryId) return;
    const same = await utils.transaction.sameMerchant.fetch({ id }, { staleTime: 0 });
    if (same.count > 0) setPrompt({ id, categoryId, merchant: same.merchant, count: same.count });
  }

  const category = categories.find((c) => c.id === prompt?.categoryId);

  const toast = prompt && (
    <Toast
      onClose={() => setPrompt(null)}
      actions={
        <>
          <button
            type="button"
            disabled={apply.isPending}
            onClick={() => {
              apply.mutate({ id: prompt.id, categoryId: prompt.categoryId });
              setPrompt(null);
            }}
            className={toastPrimary}
          >
            Yes, apply to {prompt.count === 1 ? "it" : `all ${prompt.count}`}
          </button>
          <button type="button" onClick={() => setPrompt(null)} className={toastSecondary}>
            No thanks
          </button>
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

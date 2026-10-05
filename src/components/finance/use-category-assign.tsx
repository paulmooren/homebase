"use client";

import { useEffect, useState } from "react";

import { trpc } from "@/trpc/react";
import type { Category } from "@/components/finance/category-cell";

type Prompt = { id: string; categoryId: string; merchant: string; count: number };

/** How long the offer stays on screen if you ignore it. */
const PROMPT_MS = 15_000;

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

  useEffect(() => {
    if (!prompt) return;
    const t = setTimeout(() => setPrompt(null), PROMPT_MS);
    return () => clearTimeout(t);
  }, [prompt]);

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
    <div
      role="status"
      className="fixed bottom-24 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-3 rounded-2xl bg-text p-4 text-bg shadow-2xl md:bottom-6"
    >
      <p className="text-[13.5px]">
        Also set{" "}
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <span className="block h-2 w-2 rounded-full" style={{ background: category?.color ?? "#c7c9cf" }} />
          {category?.name ?? "this category"}
        </span>{" "}
        for {prompt.count} other &ldquo;{prompt.merchant}&rdquo; transaction{prompt.count === 1 ? "" : "s"} without a
        category?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={apply.isPending}
          onClick={() => {
            apply.mutate({ id: prompt.id, categoryId: prompt.categoryId });
            setPrompt(null);
          }}
          className="flex-1 rounded-xl bg-bg px-4 py-2.5 text-[13.5px] font-semibold text-text hover:opacity-90"
        >
          Yes, apply to {prompt.count === 1 ? "it" : `all ${prompt.count}`}
        </button>
        <button
          type="button"
          onClick={() => setPrompt(null)}
          className="rounded-xl border border-white/25 px-4 py-2.5 text-[13.5px] font-medium hover:bg-white/10"
        >
          No thanks
        </button>
      </div>
    </div>
  );

  return { assign, toast };
}

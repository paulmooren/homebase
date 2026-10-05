"use client";

import { useState } from "react";

import { CheckIcon, CloseIcon } from "@/components/action-icons";

export type WishFormValues = {
  title: string;
  url: string | null;
  price: number | null;
  note: string | null;
};

/**
 * One wish, editable in place — the same inline row the Finance tables use,
 * for adding a new wish (blank) and for editing one (prefilled). Only the
 * title is required.
 */
export function InlineWishRow({
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: { title: string; url: string | null; price: number | null; note: string | null };
  pending?: boolean;
  onSubmit: (values: WishFormValues) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : "");
  const [note, setNote] = useState(initial?.note ?? "");

  const subInput =
    "min-w-0 flex-1 bg-transparent text-[12.5px] text-text-muted outline-none placeholder:text-text-faint";

  return (
    <form
      className="flex items-center gap-3 border-b border-border-soft bg-surface px-4 py-2.5 last:rounded-b-[20px] last:border-b-0 md:px-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || pending) return;
        const parsed = price.trim() === "" ? null : Number(price.replace(",", "."));
        onSubmit({
          title: title.trim(),
          url: url.trim() || null,
          price: parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
          note: note.trim() || null,
        });
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div className="min-w-0 flex-1">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
          maxLength={120}
          placeholder="What do you wish for?"
          aria-label="Wish"
          className="w-full bg-transparent text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-text-faint"
        />
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={500}
            placeholder="Link"
            aria-label="Link"
            inputMode="url"
            className={`${subInput} basis-40`}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Note"
            aria-label="Note"
            className={`${subInput} basis-40`}
          />
        </div>
      </div>
      <div className="flex items-center gap-1 text-[14px] font-semibold">
        <span className="text-text-faint">€</span>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00"
          aria-label="Price"
          inputMode="decimal"
          className="w-20 bg-transparent text-right tabular-nums outline-none placeholder:font-normal placeholder:text-text-faint"
        />
      </div>
      <button
        type="submit"
        aria-label="Save"
        disabled={!title.trim() || pending}
        className="h-4 w-4 shrink-0 text-good hover:opacity-80 disabled:text-text-faint"
      >
        <CheckIcon />
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel"
        className="h-4 w-4 shrink-0 text-text-muted hover:text-critical"
      >
        <CloseIcon />
      </button>
    </form>
  );
}

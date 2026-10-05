"use client";

import { useState } from "react";

export type WishFormValues = {
  title: string;
  url: string | null;
  price: number | null;
  note: string | null;
};

const inputClass =
  "min-w-0 rounded-xl border border-border-soft bg-surface px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-text-faint focus:border-accent";

/** Add a wish, or edit one in place (pass `initial`). Only the title is required. */
export function WishForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: { title: string; url: string | null; price: number | null; note: string | null };
  submitLabel: string;
  pending?: boolean;
  onSubmit: (values: WishFormValues) => void;
  onCancel?: () => void;
}) {
  // Reset by remounting (key) after an add; keep the fields controlled so Enter works anywhere.
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : "");
  const [note, setNote] = useState(initial?.note ?? "");

  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const parsed = price.trim() === "" ? null : Number(price.replace(",", "."));
        onSubmit({
          title: title.trim(),
          url: url.trim() || null,
          price: parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
          note: note.trim() || null,
        });
        if (!initial) {
          setTitle("");
          setUrl("");
          setPrice("");
          setNote("");
        }
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus={!!initial}
        required
        maxLength={120}
        placeholder="What do you wish for?"
        aria-label="Wish"
        className={`${inputClass} text-[15px]`}
      />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_120px]">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={500}
          placeholder="Link (optional)"
          aria-label="Link"
          inputMode="url"
          className={inputClass}
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price €"
          aria-label="Price"
          inputMode="decimal"
          className={inputClass}
        />
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        placeholder="Note — size, colour, where… (optional)"
        aria-label="Note"
        className={inputClass}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!title.trim() || pending}
          className="rounded-xl bg-accent-fill px-5 py-2.5 text-[13.5px] font-semibold text-accent-ink hover:opacity-90 disabled:bg-surface-2 disabled:text-text-faint"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border-soft px-5 py-2.5 text-[13.5px] font-medium text-text-muted hover:text-text"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";

import { VAULT_CATEGORIES, type VaultCategory } from "@/lib/vault";

export type VaultFormValues = {
  title: string;
  category: VaultCategory;
  expiresOn: Date | null;
  fields: { label: string; value: string }[];
  note: string | null;
  shared: boolean;
};

const inputClass =
  "min-w-0 rounded-xl border border-border-soft bg-surface px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-text-faint focus:border-accent";

type Initial = {
  title: string;
  category: string;
  expiresOn: Date | string | null;
  shared: boolean;
  fields: { label: string; value: string }[];
  note: string | null;
};

/**
 * Create or edit a Vault entry. When editing, `initial` is the already-revealed
 * plaintext (fetched on demand), and ownership can't be changed.
 */
export function VaultEntryForm({
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: Initial;
  pending?: boolean;
  onSubmit: (values: VaultFormValues) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<string>(initial?.category ?? VAULT_CATEGORIES[0]);
  const [shared, setShared] = useState(initial?.shared ?? false);
  const [fields, setFields] = useState(
    initial?.fields.length ? initial.fields : [{ label: "Number", value: "" }],
  );

  const setField = (i: number, patch: Partial<{ label: string; value: string }>) =>
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  return (
    <form
      className="flex flex-col gap-3 p-4 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const title = String(form.get("title") ?? "").trim();
        if (!title) return;
        // The date input is left uncontrolled and read here, so typing a year isn't fought by React.
        const rawDate = String(form.get("expiresOn") ?? "");
        onSubmit({
          title,
          category: category as VaultCategory,
          expiresOn: rawDate ? new Date(rawDate) : null,
          fields: fields
            .map((f) => ({ label: f.label.trim(), value: f.value }))
            .filter((f) => f.label && f.value),
          note: String(form.get("note") ?? "").trim() || null,
          shared,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
        <input
          name="title"
          defaultValue={initial?.title}
          required
          autoFocus
          maxLength={100}
          placeholder="Title, e.g. Passport"
          aria-label="Title"
          className={`${inputClass} text-[15px]`}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
          className={inputClass}
        >
          {VAULT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[12.5px] text-text-muted">Values — encrypted, hidden until revealed</p>
        {fields.map((field, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[180px_1fr_auto]">
            <input
              value={field.label}
              onChange={(e) => setField(i, { label: e.target.value })}
              maxLength={60}
              placeholder="Label"
              aria-label={`Label ${i + 1}`}
              className={`${inputClass} col-span-2 sm:col-span-1`}
            />
            <input
              value={field.value}
              onChange={(e) => setField(i, { value: e.target.value })}
              maxLength={500}
              placeholder="Value"
              aria-label={`Value ${i + 1}`}
              autoComplete="off"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setFields((prev) => prev.filter((_, idx) => idx !== i))}
              aria-label={`Remove field ${i + 1}`}
              className="px-2 text-[13px] text-text-faint hover:text-critical"
            >
              ✕
            </button>
          </div>
        ))}
        {fields.length < 20 && (
          <button
            type="button"
            onClick={() => setFields((prev) => [...prev, { label: "", value: "" }])}
            className="self-start text-[12.5px] font-medium text-accent hover:opacity-80"
          >
            + Add field
          </button>
        )}
      </div>

      <textarea
        name="note"
        defaultValue={initial?.note ?? ""}
        maxLength={2000}
        rows={3}
        placeholder="Note — also encrypted (optional)"
        aria-label="Note"
        className={inputClass}
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2 text-[13px] text-text-muted">
          Expires
          <input
            type="date"
            name="expiresOn"
            defaultValue={initial?.expiresOn ? new Date(initial.expiresOn).toISOString().slice(0, 10) : ""}
            aria-label="Expiry date"
            className={inputClass}
          />
        </label>

        {!initial && (
          <div className="flex overflow-hidden rounded-xl border border-border-soft text-[13px] font-medium" role="radiogroup" aria-label="Who owns this">
            {[
              { value: false, label: "Personal" },
              { value: true, label: "Shared" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={shared === option.value}
                onClick={() => setShared(option.value)}
                className={`px-4 py-2.5 transition-colors ${
                  shared === option.value ? "bg-text text-bg" : "text-text-muted hover:text-text"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent-fill px-5 py-2.5 text-[13.5px] font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
        >
          {initial ? "Save" : "Add to Vault"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-border-soft px-5 py-2.5 text-[13.5px] font-medium text-text-muted hover:text-text"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

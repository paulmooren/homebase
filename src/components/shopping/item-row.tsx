"use client";

import { useState } from "react";

import { CheckIcon, PencilIcon, TrashIcon } from "@/components/action-icons";
import { QuantityStepper } from "@/components/shopping/quantity-stepper";

export type ShoppingItemData = {
  id: string;
  name: string;
  note: string | null;
  quantity: string | null;
  checkedAt: Date | string | null;
  addedBy: { id: string; name: string | null; email: string } | null;
};

/** One item: big tick target for use in a shop, with inline edit and delete. */
export function ShoppingItemRow({
  item,
  currentUserId,
  showAddedBy,
  onToggle,
  onUpdate,
  onDelete,
  isFavorite,
  onToggleFavorite,
}: {
  item: ShoppingItemData;
  currentUserId: string;
  showAddedBy: boolean;
  onToggle: (checked: boolean) => void;
  onUpdate: (values: { name: string; quantity: string | null; note: string | null }) => void;
  onDelete: () => void;
  /** Omit to hide the star (e.g. in the compact dashboard card). */
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const checked = !!item.checkedAt;

  if (editing) {
    return (
      <form
        className="flex flex-col gap-2 border-b border-border-soft bg-surface-2 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const name = String(form.get("name") ?? "").trim();
          if (!name) return;
          onUpdate({
            name,
            quantity: String(form.get("quantity") ?? "").trim() || null,
            note: String(form.get("note") ?? "").trim() || null,
          });
          setEditing(false);
        }}
      >
        <input
          name="name"
          defaultValue={item.name}
          autoFocus
          required
          maxLength={120}
          aria-label="Item name"
          className="min-w-0 flex-1 rounded-lg border border-border-soft bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent"
        />
        <input
          name="quantity"
          defaultValue={item.quantity ?? ""}
          maxLength={30}
          placeholder="Amount"
          aria-label="Amount"
          className="min-w-0 rounded-lg border border-border-soft bg-surface px-3 py-2 text-[14px] outline-none placeholder:text-text-faint focus:border-accent sm:w-28"
        />
        <input
          name="note"
          defaultValue={item.note ?? ""}
          maxLength={200}
          placeholder="Note (optional)"
          aria-label="Note"
          className="min-w-0 flex-1 rounded-lg border border-border-soft bg-surface px-3 py-2 text-[14px] outline-none placeholder:text-text-faint focus:border-accent"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-accent-fill px-4 py-2 text-[13px] font-semibold text-accent-ink hover:opacity-90"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-border-soft px-4 py-2 text-[13px] font-medium text-text-muted hover:text-text"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  const addedByOther = item.addedBy && item.addedBy.id !== currentUserId;

  return (
    <div className="flex items-center gap-2.5 border-b border-border-soft px-4 py-2.5 transition-colors last:border-b-0 hover:bg-surface-hover">
      <button
        type="button"
        onClick={() => onToggle(!checked)}
        aria-label={checked ? `Put ${item.name} back on the list` : `Tick off ${item.name}`}
        aria-pressed={checked}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
          checked
            ? "border-good bg-good text-white"
            : "border-border text-transparent hover:border-good hover:text-good"
        }`}
      >
        <span className="block h-4 w-4">
          <CheckIcon />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        {renaming ? (
          <input
            defaultValue={item.name}
            autoFocus
            maxLength={120}
            aria-label="Item name"
            className="w-full rounded-md bg-surface-2 px-1.5 py-0.5 text-[15px] font-medium outline-none"
            onBlur={(e) => {
              setRenaming(false);
              const name = e.target.value.trim();
              if (name && name !== item.name) onUpdate({ name, quantity: item.quantity, note: item.note });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                e.currentTarget.value = item.name;
                e.currentTarget.blur();
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            aria-label={`Rename ${item.name}`}
            className={`block max-w-full truncate text-left text-[15px] ${
              checked ? "text-text-faint line-through" : "font-medium"
            }`}
          >
            {item.name}
          </button>
        )}
        {(item.note || (showAddedBy && addedByOther)) && (
          <div className="truncate text-[12px] text-text-muted">
            {[item.note, showAddedBy && addedByOther ? `Added by ${item.addedBy!.name || item.addedBy!.email}` : null]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
      </div>

      <QuantityStepper
        value={item.quantity}
        muted={checked}
        onChange={(quantity) => onUpdate({ name: item.name, quantity, note: item.note })}
      />

      {onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`}
          aria-pressed={isFavorite}
          className={`shrink-0 text-[16px] leading-none transition-colors ${
            isFavorite ? "text-[#e0b04d]" : "text-text-faint hover:text-[#e0b04d]"
          }`}
        >
          {isFavorite ? "★" : "☆"}
        </button>
      )}

      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${item.name}`}
        className="h-4 w-4 shrink-0 text-text-faint hover:text-text"
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${item.name}`}
        className="h-4 w-4 shrink-0 text-text-faint hover:text-critical"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";

import { CheckIcon, PencilIcon, TrashIcon } from "@/components/action-icons";

export type ShoppingItemData = {
  id: string;
  name: string;
  note: string | null;
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
}: {
  item: ShoppingItemData;
  currentUserId: string;
  showAddedBy: boolean;
  onToggle: (checked: boolean) => void;
  onUpdate: (values: { name: string; note: string | null }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
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
          onUpdate({ name, note: String(form.get("note") ?? "").trim() || null });
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
    <div className="flex items-center gap-3.5 border-b border-border-soft px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-hover">
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
        <div className={`truncate text-[15px] ${checked ? "text-text-faint line-through" : "font-medium"}`}>
          {item.name}
        </div>
        {(item.note || (showAddedBy && addedByOther)) && (
          <div className="truncate text-[12px] text-text-muted">
            {[item.note, showAddedBy && addedByOther ? `Added by ${item.addedBy!.name || item.addedBy!.email}` : null]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
      </div>

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

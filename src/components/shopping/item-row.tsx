"use client";

import { useState } from "react";

import { CheckIcon } from "@/components/action-icons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { InlineEdit } from "@/components/inline-edit";
import { QuantityPill, parseAmount } from "@/components/shopping/quantity-stepper";
import { TICK_GRACE_MS } from "@/components/shopping/use-shopping";

export type ShoppingItemData = {
  id: string;
  name: string;
  quantity: string | null;
  checkedAt: Date | string | null;
  addedBy: { id: string; name: string | null; email: string } | null;
};

/**
 * One item: tick box, − 2 + pill, and a name you can click to rename. There is
 * no edit form and no bin — pressing − at the lowest amount asks to remove it.
 */
export function ShoppingItemRow({
  item,
  currentUserId,
  showAddedBy,
  onToggle,
  onUpdate,
  onDelete,
  isFavorite,
  onToggleFavorite,
  leaving,
}: {
  item: ShoppingItemData;
  currentUserId: string;
  showAddedBy: boolean;
  onToggle: (checked: boolean) => void;
  onUpdate: (values: { name?: string; quantity?: string | null }) => void;
  onDelete: () => void;
  /** Omit to hide the star (e.g. in the compact dashboard card). */
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** Just ticked: struck through and fading out until it disappears. */
  leaving?: boolean;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const checked = !!item.checkedAt;
  const addedByOther = item.addedBy && item.addedBy.id !== currentUserId;
  const unit = parseAmount(item.quantity).unit;
  const subtext = [unit || null, showAddedBy && addedByOther ? `Added by ${item.addedBy!.name || item.addedBy!.email}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`flex items-center gap-3 border-b border-border-soft px-4 py-2.5 transition-colors last:border-b-0 hover:bg-surface-hover ${
        leaving && checked ? "shopping-leave" : ""
      }`}
      style={leaving && checked ? { animationDuration: `${TICK_GRACE_MS}ms` } : undefined}
    >
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

      {checked ? (
        // In the basket: a plain amount, no stepper — it's done.
        item.quantity && <span className="shrink-0 text-[14px] tabular-nums text-text-faint">{item.quantity}</span>
      ) : (
        <QuantityPill
          value={item.quantity}
          onChange={(quantity) => onUpdate({ quantity })}
          onRemove={() => setConfirmRemove(true)}
        />
      )}

      <div className="min-w-0 flex-1">
        <InlineEdit
          value={item.name}
          ariaLabel="Item name"
          onCommit={(name) => onUpdate({ name })}
          display={<span className={checked ? "shopping-strike" : ""}>{item.name}</span>}
          className={`text-[15px] ${checked ? "text-text-faint" : "font-medium"}`}
        />
        {subtext && <div className="truncate text-[12px] text-text-muted">{subtext}</div>}
      </div>

      {onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`}
          aria-pressed={isFavorite}
          className={`shrink-0 text-[18px] leading-none transition-colors ${
            isFavorite ? "text-[#e0b04d]" : "text-text-faint hover:text-[#e0b04d]"
          }`}
        >
          {isFavorite ? "★" : "☆"}
        </button>
      )}

      {confirmRemove && (
        <ConfirmDialog
          title={`Remove ${item.name}?`}
          description="It will be taken off the list."
          confirmLabel="Remove"
          onConfirm={() => {
            setConfirmRemove(false);
            onDelete();
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

import type { ShoppingItemData } from "@/components/shopping/item-row";

export type FavoriteData = { id: string; name: string; quantity: string | null };

/**
 * One-tap chips for the things you regularly buy. Tapping adds the item, or
 * puts it back on the list if it's already in the basket; it's dimmed while
 * it's already waiting on the list. "Edit" lets you remove favorites.
 */
export function FavoritesStrip({
  favorites,
  items,
  onAdd,
  onRestore,
  onRemove,
  compact,
}: {
  favorites: FavoriteData[];
  items: ShoppingItemData[];
  onAdd: (favorite: FavoriteData) => void;
  onRestore: (itemId: string) => void;
  onRemove?: (id: string) => void;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (favorites.length === 0) {
    if (compact || !onRemove) return null;
    return (
      <p className="px-4 pb-3 text-[12.5px] text-text-faint md:px-6">
        ★ Star an item you buy often and it will wait here, one tap from the list.
      </p>
    );
  }

  const shown = compact ? favorites.slice(0, 8) : favorites;

  return (
    <div className="px-4 pb-3 md:px-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">Favorites</p>
        {onRemove && !compact && (
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="text-[12px] font-medium text-text-muted hover:text-text"
          >
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {shown.map((fav) => {
          const existing = items.find((i) => i.name.toLowerCase() === fav.name.toLowerCase());
          const onList = !!existing && !existing.checkedAt;
          const label = fav.quantity ? `${fav.name} · ${fav.quantity}` : fav.name;

          if (editing && onRemove) {
            return (
              <span
                key={fav.id}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface pr-1.5 pl-3.5 text-[13.5px]"
              >
                {label}
                <button
                  type="button"
                  onClick={() => onRemove(fav.id)}
                  aria-label={`Remove ${fav.name} from favorites`}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-text-faint hover:bg-surface-2 hover:text-critical"
                >
                  ✕
                </button>
              </span>
            );
          }

          return (
            <button
              key={fav.id}
              type="button"
              disabled={onList}
              onClick={() => (existing ? onRestore(existing.id) : onAdd(fav))}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors ${
                onList
                  ? "border-border-soft bg-surface-2 text-text-faint"
                  : "border-border bg-surface text-text hover:border-text"
              }`}
            >
              {onList ? "✓" : "+"} {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

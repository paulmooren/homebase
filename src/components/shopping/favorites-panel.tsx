"use client";

import { useState } from "react";

import { CheckIcon, CloseIcon, PlusIcon } from "@/components/action-icons";
import { InlineEdit } from "@/components/inline-edit";
import type { ShoppingItemData } from "@/components/shopping/item-row";

export type FavoriteData = { id: string; name: string };

/**
 * The Favorites of one list as an alphabetical list: tap + to add one to the
 * list (or put it back if it's already in the basket), click its name to
 * change it in place, and add new ones with "+ Add favorite" at the bottom.
 */
export function FavoritesPanel({
  favorites,
  items,
  onAdd,
  onRestore,
  onRemove,
  onRename,
  onCreate,
}: {
  favorites: FavoriteData[];
  items: ShoppingItemData[];
  onAdd: (favorite: FavoriteData) => void;
  onRestore: (itemId: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onCreate: (name: string) => void;
}) {
  const sorted = [...favorites].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return (
    <div>
      {sorted.length === 0 && (
        <p className="px-4 py-4 text-[13px] text-text-muted md:px-5">
          Nothing here yet. Add the things you buy often, or tap ☆ on an item in the list.
        </p>
      )}

      {sorted.map((fav) => {
        const existing = items.find((i) => i.name.toLowerCase() === fav.name.toLowerCase());
        const onList = !!existing && !existing.checkedAt;
        return (
          <div
            key={fav.id}
            className="group flex items-center gap-2.5 border-b border-border-soft px-4 py-2.5 transition-colors hover:bg-surface-hover md:px-5"
          >
            <button
              type="button"
              disabled={onList}
              onClick={() => (existing ? onRestore(existing.id) : onAdd(fav))}
              aria-label={onList ? `${fav.name} is already on the list` : `Add ${fav.name} to the list`}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                onList
                  ? "border-border-soft bg-surface-2 text-text-faint"
                  : "border-border text-text-muted hover:border-text hover:text-text"
              }`}
            >
              <span className="block h-3.5 w-3.5">{onList ? <CheckIcon /> : <PlusIcon />}</span>
            </button>
            <div className="min-w-0 flex-1">
              <InlineEdit
                value={fav.name}
                ariaLabel="Favorite name"
                onCommit={(name) => onRename(fav.id, name)}
                className={`text-[14.5px] ${onList ? "text-text-faint" : "font-medium"}`}
              />
            </div>
            <button
              type="button"
              onClick={() => onRemove(fav.id)}
              aria-label={`Remove ${fav.name} from favorites`}
              className="h-3 w-3 shrink-0 text-text-faint hover:text-critical lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
            >
              <CloseIcon />
            </button>
          </div>
        );
      })}

      <AddFavoriteRow onCreate={onCreate} />
    </div>
  );
}

/** "+ Add favorite": same pattern as "+ Add item" — opens a line and stays open for the next one. */
function AddFavoriteRow({ onCreate }: { onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function close() {
    setOpen(false);
    setName("");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-text-faint transition-colors hover:text-text md:px-5"
      >
        <span className="block h-2.5 w-2.5 shrink-0">
          <PlusIcon />
        </span>
        <span className="text-[14px]">Add favorite</span>
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-2.5 bg-surface-2 px-4 py-2.5 md:px-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate(name.trim());
        setName("");
            (e.currentTarget.elements.namedItem("name") as HTMLInputElement | null)?.focus();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        maxLength={120}
        placeholder="Favorite"
        aria-label="Favorite"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-[14.5px] font-medium outline-none placeholder:font-normal placeholder:text-text-faint"
      />
      <button type="submit" aria-label="Add favorite" className="h-4 w-4 shrink-0 text-good hover:opacity-80">
        <CheckIcon />
      </button>
      <button type="button" onClick={close} aria-label="Done adding" className="h-4 w-4 shrink-0 text-text-muted hover:text-critical">
        <CloseIcon />
      </button>
    </form>
  );
}

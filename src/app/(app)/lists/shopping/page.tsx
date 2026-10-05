"use client";

import { useState } from "react";

import { trpc } from "@/trpc/react";
import { ModuleGate } from "@/components/use-modules";
import { AddItemRow } from "@/components/shopping/add-item-row";
import { FavoritesStrip } from "@/components/shopping/favorites-strip";
import { ShoppingItemRow } from "@/components/shopping/item-row";
import {
  useShoppingActions,
  useShoppingFavorites,
  useShoppingItems,
} from "@/components/shopping/use-shopping";

export default function ShoppingPage() {
  return (
    <ModuleGate module="shopping">
      <ShoppingLists />
    </ModuleGate>
  );
}

function ShoppingLists() {
  const utils = trpc.useUtils();
  const { data: lists } = trpc.shopping.lists.useQuery();
  const { data: me } = trpc.user.me.useQuery();
  const { data: household } = trpc.household.current.useQuery();

  const [choice, setChoice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const selected = lists?.find((l) => l.id === choice) ?? lists?.[0];
  const { data: items } = useShoppingItems(selected?.id);
  const { data: favorites } = useShoppingFavorites(selected?.id);
  const actions = useShoppingActions(selected?.id);

  const refreshLists = () => utils.shopping.lists.invalidate();
  const createList = trpc.shopping.createList.useMutation({
    onSuccess: (list) => {
      refreshLists();
      setChoice(list.id);
      setCreating(false);
    },
  });
  const renameList = trpc.shopping.renameList.useMutation({ onSuccess: refreshLists });
  const deleteList = trpc.shopping.deleteList.useMutation({
    onSuccess: () => {
      setChoice(null);
      refreshLists();
    },
  });

  if (!lists || !me) return null;

  const multiMember = (household?.members.length ?? 0) > 1;
  const open = items?.filter((i) => !i.checkedAt) ?? [];
  const inBasket = items?.filter((i) => i.checkedAt) ?? [];
  const isShared = selected ? selected.ownerId === null : true;

  const favoriteFor = (name: string) =>
    favorites?.find((f) => f.name.toLowerCase() === name.toLowerCase());

  const renderRow = (item: NonNullable<typeof items>[number]) => {
    const favorite = favoriteFor(item.name);
    return (
      <ShoppingItemRow
        key={item.id}
        item={item}
        currentUserId={me.id}
        showAddedBy={isShared && multiMember}
        isFavorite={!!favorite}
        onToggleFavorite={() =>
          favorite
            ? actions.removeFavorite.mutate({ id: favorite.id })
            : actions.addFavorite.mutate({ listId: selected!.id, name: item.name, quantity: item.quantity })
        }
        onToggle={(checked) => actions.setChecked.mutate({ id: item.id, checked })}
        onUpdate={(values) => actions.updateItem.mutate({ id: item.id, ...values })}
        onDelete={() => actions.deleteItem.mutate({ id: item.id })}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Shopping lists">
        {lists.map((list) => {
          const active = list.id === selected?.id;
          return (
            <button
              key={list.id}
              type="button"
              aria-pressed={active}
              onClick={() => setChoice(list.id)}
              className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[13.5px] font-medium transition-colors ${
                active
                  ? "border-text bg-text text-bg"
                  : "border-border bg-surface text-text-muted hover:border-text-faint hover:text-text"
              }`}
            >
              {list.name}
              {list.openCount > 0 && (
                <span className={`text-[12px] tabular-nums ${active ? "text-bg/70" : "text-text-faint"}`}>
                  {list.openCount}
                </span>
              )}
              {list.ownerId !== null && (
                <span className={`text-[11px] ${active ? "text-bg/70" : "text-text-faint"}`}>Private</span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="inline-flex h-9 items-center rounded-full border border-dashed border-border px-4 text-[13.5px] font-medium text-text-muted hover:border-text-faint hover:text-text"
        >
          {creating ? "Cancel" : "+ New list"}
        </button>
      </div>

      {creating && (
        <NewListForm
          pending={createList.isPending}
          onSubmit={(name, shared) => createList.mutate({ name, shared })}
        />
      )}

      {selected && (
        <section className="rounded-[20px] border border-border-soft bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-5 pb-3 md:px-6">
            <div className="min-w-0">
              <h2 className="truncate text-[17px] font-semibold">{selected.name}</h2>
              <p className="text-[12px] text-text-muted">
                {isShared ? "Shared — everyone in your household" : "Private — only you"}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[12.5px] font-medium">
              <button
                type="button"
                onClick={() => {
                  const name = prompt("Rename list", selected.name)?.trim();
                  if (name && name !== selected.name) renameList.mutate({ id: selected.id, name });
                }}
                className="text-text-muted hover:text-text"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete "${selected.name}" and everything on it?`)) {
                    deleteList.mutate({ id: selected.id });
                  }
                }}
                className="text-text-muted hover:text-critical"
              >
                Delete
              </button>
            </div>
          </div>

          <FavoritesStrip
            favorites={favorites ?? []}
            items={items ?? []}
            onAdd={(fav) => actions.addItem.mutate({ listId: selected.id, name: fav.name, quantity: fav.quantity })}
            onRestore={(id) => actions.setChecked.mutate({ id, checked: false })}
            onRemove={(id) => actions.removeFavorite.mutate({ id })}
          />

          <div className="border-t border-border-soft">
            {items && open.length === 0 && inBasket.length === 0 && (
              <p className="px-6 py-6 text-[13.5px] text-text-muted">Nothing on this list yet.</p>
            )}
            {items && open.length === 0 && inBasket.length > 0 && (
              <p className="px-6 py-4 text-[13.5px] text-text-muted">Everything is in the basket.</p>
            )}

            {open.map((item) => renderRow(item))}

            <AddItemRow
              listId={selected.id}
              onAdd={({ name, quantity }) => actions.addItem.mutate({ listId: selected.id, name, quantity })}
            />

            {inBasket.length > 0 && (
              <>
                <div className="flex items-center justify-between border-t border-border-soft bg-surface-2 px-4 py-2.5 md:px-6">
                  <p className="text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
                    In basket · {inBasket.length}
                  </p>
                  <button
                    type="button"
                    onClick={() => actions.clearChecked.mutate({ listId: selected.id })}
                    className="text-[12.5px] font-medium text-accent hover:opacity-80"
                  >
                    Clear checked
                  </button>
                </div>
                {inBasket.map((item) => renderRow(item))}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function NewListForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (name: string, shared: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [shared, setShared] = useState(true);

  return (
    <form
      className="flex flex-col gap-3 rounded-[20px] border border-border-soft bg-surface p-4 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim(), shared);
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        maxLength={60}
        placeholder="List name, e.g. Pharmacy"
        aria-label="List name"
        className="min-w-0 flex-1 rounded-xl border border-border-soft bg-surface px-3.5 py-2.5 text-[14px] outline-none placeholder:text-text-faint focus:border-accent"
      />
      <div className="flex overflow-hidden rounded-xl border border-border-soft text-[13px] font-medium" role="radiogroup">
        {[
          { value: true, label: "Shared" },
          { value: false, label: "Private" },
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
      <button
        type="submit"
        disabled={!name.trim() || pending}
        className="rounded-xl bg-accent-fill px-5 py-2.5 text-[13.5px] font-semibold text-accent-ink hover:opacity-90 disabled:bg-surface-2 disabled:text-text-faint"
      >
        Create
      </button>
    </form>
  );
}

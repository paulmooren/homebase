"use client";

import { useEffect, useState } from "react";

import { trpc } from "@/trpc/react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { InlineEdit } from "@/components/inline-edit";
import { ModuleGate } from "@/components/use-modules";
import { AddItemRow } from "@/components/shopping/add-item-row";
import { FavoritesPanel } from "@/components/shopping/favorites-panel";
import { ShoppingItemRow } from "@/components/shopping/item-row";
import {
  useShoppingActions,
  useShoppingFavorites,
  useShoppingItems,
  useTickGrace,
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
  // Below lg there is no room for two columns: a switch flips between them, or a sheet slides over the list.
  const [mobileView, setMobileView] = useState<"list" | "favorites">("list");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDeleteList, setConfirmDeleteList] = useState(false);

  const selected = lists?.find((l) => l.id === choice) ?? lists?.[0];
  const { data: items } = useShoppingItems(selected?.id);
  const { data: favorites } = useShoppingFavorites(selected?.id);
  const actions = useShoppingActions(selected?.id);
  const ticks = useTickGrace();

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

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  if (!lists || !me) return null;

  const multiMember = (household?.members.length ?? 0) > 1;
  // Ticked items stay (struck through) only for the grace period, then drop off.
  const open = items?.filter((i) => !i.checkedAt || ticks.leaving.has(i.id)) ?? [];
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
            : actions.addFavorite.mutate({ listId: selected!.id, name: item.name })
        }
        leaving={ticks.leaving.has(item.id)}
        onToggle={(checked) => {
          if (checked) ticks.start(item.id);
          else ticks.cancel(item.id);
          actions.setChecked.mutate({ id: item.id, checked });
        }}
        onUpdate={(values) => actions.updateItem.mutate({ id: item.id, ...values })}
        onDelete={() => actions.deleteItem.mutate({ id: item.id })}
      />
    );
  };

  const favoritesHeader = selected && (
    <div className="flex items-baseline justify-between px-4 pt-5 pb-3 md:px-5">
      <div>
        <h2 className="text-[16px] font-semibold">Favorites</h2>
        <p className="text-[12px] text-text-muted">What you buy often, for {selected.name}</p>
      </div>
      <button
        type="button"
        onClick={() => setSheetOpen(false)}
        className="text-[12.5px] font-medium text-text-muted hover:text-text lg:hidden"
        hidden={!sheetOpen}
      >
        Close
      </button>
    </div>
  );

  const favoritesPanel = selected && (
    <FavoritesPanel
      favorites={favorites ?? []}
      items={items ?? []}
      onAdd={(fav) => actions.addItem.mutate({ listId: selected.id, name: fav.name })}
      onRestore={(id) => actions.setChecked.mutate({ id, checked: false })}
      onRemove={(id) => actions.removeFavorite.mutate({ id })}
      onRename={(id, name) => actions.updateFavorite.mutate({ id, name })}
      onCreate={(name) => actions.addFavorite.mutate({ listId: selected.id, name })}
    />
  );

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
        <div className="flex rounded-xl border border-border-soft bg-surface p-1 text-[13px] font-medium lg:hidden" role="tablist">
          {(["list", "favorites"] as const).map((view) => (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={mobileView === view}
              onClick={() => setMobileView(view)}
              className={`flex-1 rounded-lg px-4 py-2 transition-colors ${
                mobileView === view ? "bg-text text-bg" : "text-text-muted hover:text-text"
              }`}
            >
              {view === "list" ? "List" : `Favorites${favorites?.length ? ` · ${favorites.length}` : ""}`}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className={`rounded-[20px] border border-border-soft bg-surface ${mobileView === "favorites" ? "hidden lg:block" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-5 pb-3 md:px-6">
            <div className="min-w-0">
              <InlineEdit
                key={selected.id}
                value={selected.name}
                ariaLabel="List name"
                maxLength={60}
                onCommit={(name) => renameList.mutate({ id: selected.id, name })}
                className="text-[17px] font-semibold"
              />
              <p className="text-[12px] text-text-muted">
                {isShared ? "Shared — everyone in your household" : "Private — only you"}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[12.5px] font-medium">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="rounded-full border border-border px-3 py-1 text-text hover:border-text lg:hidden"
              >
                ★ Favorites
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteList(true)}
                className="text-text-muted hover:text-critical"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="border-t border-border-soft">
            {items && open.length === 0 && (
              <p className="px-6 py-6 text-[13.5px] text-text-muted">Nothing on this list.</p>
            )}

            {open.map((item) => renderRow(item))}

            <AddItemRow
              listId={selected.id}
              onAdd={({ name }) => actions.addItem.mutate({ listId: selected.id, name })}
            />
          </div>
        </section>

        <section
          className={`rounded-[20px] border border-border-soft bg-surface lg:sticky lg:top-6 ${
            mobileView === "favorites" ? "" : "hidden lg:block"
          }`}
        >
          {favoritesHeader}
          {favoritesPanel}
        </section>
        </div>
      )}

      {selected && confirmDeleteList && (
        <ConfirmDialog
          title={`Delete ${selected.name}?`}
          description="The list and everything on it will be removed."
          confirmLabel="Delete list"
          onConfirm={() => {
            setConfirmDeleteList(false);
            deleteList.mutate({ id: selected.id });
          }}
          onCancel={() => setConfirmDeleteList(false)}
        />
      )}

      {selected && sheetOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Favorites">
          <button
            type="button"
            aria-label="Close favorites"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-[20px] bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl">
            {favoritesHeader}
            {favoritesPanel}
          </div>
        </div>
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

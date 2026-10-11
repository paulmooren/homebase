"use client";

import { useState } from "react";
import { Button } from "@base-ui/react/button";
import { Dialog } from "@base-ui/react/dialog";
import { Input } from "@base-ui/react/input";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";

import { trpc } from "@/trpc/react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { InlineEdit } from "@/components/inline-edit";
import { returnFocusTo, useOpener } from "@/components/ui/focus";
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
      <Button
        type="button"
        onClick={() => setSheetOpen(false)}
        className="text-[12.5px] font-medium text-text-muted hover:text-text lg:hidden"
        hidden={!sheetOpen}
      >
        Close
      </Button>
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
            <Button
              key={list.id}
              type="button"
              aria-pressed={active}
              onClick={() => setChoice(list.id)}
              className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[13.5px] font-medium transition-colors ${
                active
                  ? "border-text bg-text text-bg"
                  : "border-transparent bg-surface-2 text-text-muted hover:bg-border-soft hover:text-text"
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
            </Button>
          );
        })}
        <Button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="inline-flex h-9 items-center rounded-full border border-dashed border-border px-4 text-[13.5px] font-medium text-text-muted hover:border-text-faint hover:text-text"
        >
          {creating ? "Cancel" : "+ New list"}
        </Button>
      </div>

      {creating && (
        <NewListForm
          pending={createList.isPending}
          onSubmit={(name, shared) => createList.mutate({ name, shared })}
        />
      )}

      {selected && (
        <div className="flex rounded-xl bg-surface-2 p-1 text-[13px] font-medium lg:hidden" role="tablist">
          {(["list", "favorites"] as const).map((view) => (
            <Button
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
            </Button>
          ))}
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className={mobileView === "favorites" ? "hidden lg:block" : ""}>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pb-4">
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
              <Button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="rounded-full border border-border px-3 py-1 text-text hover:border-text lg:hidden"
              >
                ★ Favorites
              </Button>
              <Button
                type="button"
                onClick={() => setConfirmDeleteList(true)}
                className="text-text-muted hover:text-critical"
              >
                Delete
              </Button>
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
        <FavoritesSheet onClose={() => setSheetOpen(false)}>
          {favoritesHeader}
          {favoritesPanel}
        </FavoritesSheet>
      )}
    </div>
  );
}

/** The favorites as a sheet from the bottom of the screen (phones and tablets only; on a desktop they sit beside the list). */
function FavoritesSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  // Focus goes back to what opened the sheet when it closes.
  const opener = useOpener();
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 supports-[-webkit-touch-callout:none]:absolute lg:hidden" />
        <Dialog.Viewport className="fixed inset-0 z-40 flex items-end lg:hidden">
          <Dialog.Popup
            aria-label="Favorites"
            finalFocus={returnFocusTo(opener)}
            className="max-h-[80vh] w-full overflow-y-auto rounded-t-[20px] bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none"
          >
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
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
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        maxLength={60}
        placeholder="List name, e.g. Pharmacy"
        aria-label="List name"
        className="min-w-0 flex-1 rounded-xl border border-border-soft bg-surface px-3.5 py-2.5 text-[14px] outline-none placeholder:text-text-faint focus:border-accent"
      />
      <RadioGroup
        aria-label="List visibility"
        value={shared ? "shared" : "private"}
        onValueChange={(next) => setShared(next === "shared")}
        className="flex overflow-hidden rounded-xl border border-border-soft text-[13px] font-medium"
      >
        {[
          { value: "shared", label: "Shared" },
          { value: "private", label: "Private" },
        ].map((option) => (
          <Radio.Root
            key={option.value}
            value={option.value}
            className="cursor-pointer px-4 py-2.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent data-checked:bg-text data-checked:text-bg data-unchecked:text-text-muted data-unchecked:hover:text-text"
          >
            {option.label}
          </Radio.Root>
        ))}
      </RadioGroup>
      <Button
        type="submit"
        disabled={!name.trim() || pending}
        className="rounded-xl bg-accent-fill px-5 py-2.5 text-[13.5px] font-semibold text-accent-ink hover:opacity-90 disabled:bg-surface-2 disabled:text-text-faint"
      >
        Create
      </Button>
    </form>
  );
}

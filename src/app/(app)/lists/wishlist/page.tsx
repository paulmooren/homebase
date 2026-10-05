"use client";

import { useState } from "react";

import { trpc } from "@/trpc/react";
import { Avatar } from "@/components/avatar";
import { ModuleGate } from "@/components/use-modules";
import { VisibilityToggle } from "@/components/finance/visibility-toggle";
import { PlusIcon } from "@/components/action-icons";
import { InlineWishRow } from "@/components/wishlist/wish-form";
import { WishRow } from "@/components/wishlist/wish-row";

const HOME = "home";

export default function WishlistPage() {
  return (
    <ModuleGate module="wishlist">
      <Wishlists />
    </ModuleGate>
  );
}

function Wishlists() {
  const utils = trpc.useUtils();
  const { data: household } = trpc.household.current.useQuery();
  const { data: me } = trpc.user.me.useQuery();
  const [choice, setChoice] = useState<string | null>(null);
  const [showReceived, setShowReceived] = useState(false);
  const [adding, setAdding] = useState(false);

  const selected = choice ?? me?.id ?? HOME;
  const isHome = selected === HOME;
  const ownerId = isHome ? null : selected;
  const ownList = !isHome && selected === me?.id;

  const { data: wishes } = trpc.wishlist.list.useQuery(
    { ownerId },
    { enabled: !!me, refetchInterval: 10_000 },
  );

  const refresh = () => utils.wishlist.list.invalidate();
  const add = trpc.wishlist.add.useMutation({ onSuccess: refresh });
  const update = trpc.wishlist.update.useMutation({ onSuccess: refresh });
  const remove = trpc.wishlist.delete.useMutation({ onSuccess: refresh });
  const setReceived = trpc.wishlist.setReceived.useMutation({ onSuccess: refresh });
  const claim = trpc.wishlist.claim.useMutation({ onSuccess: refresh, onError: refresh });
  const unclaim = trpc.wishlist.unclaim.useMutation({ onSuccess: refresh });
  const setVisibility = trpc.wishlist.setVisibility.useMutation({
    onSuccess: () => utils.household.current.invalidate(),
  });

  if (!household || !me) return null;

  // Everyone except housemates who have hidden their list — those don't appear at all.
  const people = [
    ...household.members.filter((m) => m.user.id === me.id),
    ...household.members.filter((m) => m.user.id !== me.id && m.wishlistVisible),
  ];
  const myMember = household.members.find((m) => m.user.id === me.id);
  const owner = household.members.find((m) => m.user.id === selected);
  const ownerName = owner?.user.name || owner?.user.email || "them";

  const canEdit = ownList || isHome;
  const active = wishes?.filter((w) => !w.receivedAt) ?? [];
  const received = wishes?.filter((w) => w.receivedAt) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Wishlists">
        {people.map((m) => {
          const isMe = m.user.id === me.id;
          const label = isMe ? "You" : m.user.name || m.user.email;
          const isActive = selected === m.user.id;
          return (
            <button
              key={m.user.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setChoice(m.user.id);
                setAdding(false);
              }}
              className={`inline-flex h-9 items-center gap-2 rounded-full border pr-4 pl-1.5 text-[13.5px] font-medium transition-colors ${
                isActive
                  ? "border-text bg-text text-bg"
                  : "border-border bg-surface text-text-muted hover:border-text-faint hover:text-text"
              }`}
            >
              <Avatar name={m.user.name || m.user.email} image={m.user.image} size={24} />
              {label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={isHome}
          onClick={() => {
            setChoice(HOME);
            setAdding(false);
          }}
          className={`inline-flex h-9 items-center rounded-full border px-4 text-[13.5px] font-medium transition-colors ${
            isHome
              ? "border-text bg-text text-bg"
              : "border-border bg-surface text-text-muted hover:border-text-faint hover:text-text"
          }`}
        >
          Home
        </button>
      </div>

      <section className="rounded-[20px] border border-border-soft bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-5 pb-3 md:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold">
              {isHome ? "Home" : ownList ? "Your wishlist" : `${ownerName}'s wishlist`}
            </h2>
            <p className="text-[12px] text-text-muted">
              {isHome
                ? "Things the whole household wants. Anyone can add, and everyone sees who's getting what."
                : ownList
                  ? "You never see who has claimed something — that's the surprise."
                  : `Claim something and ${ownerName} won't see it.`}
            </p>
          </div>
          {ownList && myMember && (
            <VisibilityToggle
              visible={myMember.wishlistVisible}
              pending={setVisibility.isPending}
              onChange={(visible) => setVisibility.mutate({ visible })}
            />
          )}
        </div>

        <div className="border-t border-border-soft">
          {wishes && active.length === 0 && (
            <p className="px-6 py-6 text-[13.5px] text-text-muted">
              {canEdit ? "No wishes yet." : "Nothing on this wishlist yet."}
            </p>
          )}
          {active.map((wish) => (
            <WishRow
              key={wish.id}
              wish={wish}
              canEdit={canEdit}
              ownList={ownList}
              onUpdate={(values) => update.mutate({ id: wish.id, ...values })}
              onDelete={() => {
                if (confirm(`Delete "${wish.title}"?`)) remove.mutate({ id: wish.id });
              }}
              onSetReceived={(r) => setReceived.mutate({ id: wish.id, received: r })}
              onClaim={() => claim.mutate({ id: wish.id })}
              onUnclaim={() => unclaim.mutate({ id: wish.id })}
            />
          ))}

          {canEdit &&
            (adding ? (
              <InlineWishRow
                pending={add.isPending}
                onSubmit={(values) => {
                  add.mutate({ home: isHome, ...values });
                  setAdding(false);
                }}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-3 border-b border-border-soft px-4 py-3.5 text-left text-text-faint transition-colors last:rounded-b-[20px] last:border-b-0 hover:text-text md:px-6"
              >
                <span className="block h-2.5 w-2.5 shrink-0">
                  <PlusIcon />
                </span>
                <span className="text-[14px]">Add wish</span>
              </button>
            ))}

          {received.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowReceived((s) => !s)}
                className="flex w-full items-center justify-between border-t border-border-soft bg-surface-2 px-4 py-2.5 text-left md:px-6"
                aria-expanded={showReceived}
              >
                <span className="text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
                  Received · {received.length}
                </span>
                <span className="text-[12.5px] font-medium text-accent">{showReceived ? "Hide" : "Show"}</span>
              </button>
              {showReceived &&
                received.map((wish) => (
                  <WishRow
                    key={wish.id}
                    wish={wish}
                    canEdit={canEdit}
                    ownList={ownList}
                    onUpdate={(values) => update.mutate({ id: wish.id, ...values })}
                    onDelete={() => {
                      if (confirm(`Delete "${wish.title}"?`)) remove.mutate({ id: wish.id });
                    }}
                    onSetReceived={(r) => setReceived.mutate({ id: wish.id, received: r })}
                    onClaim={() => claim.mutate({ id: wish.id })}
                    onUnclaim={() => unclaim.mutate({ id: wish.id })}
                  />
                ))}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

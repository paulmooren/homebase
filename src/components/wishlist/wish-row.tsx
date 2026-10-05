"use client";

import { useState } from "react";

import { formatEUR } from "@/lib/format";
import { PencilIcon, TrashIcon } from "@/components/action-icons";
import { InlineEdit } from "@/components/inline-edit";
import { InlineWishRow, type WishFormValues } from "@/components/wishlist/wish-form";

export type WishData = {
  id: string;
  title: string;
  url: string | null;
  price: number | null;
  note: string | null;
  receivedAt: Date | string | null;
  claimedBy: { id: string; name: string | null; email: string } | null;
  claimedByMe: boolean;
};

/**
 * One wish. `canEdit` is true for your own wishes and any Home wish; otherwise
 * the row is read-only except for Claiming. `ownList` hides all Claim UI —
 * the owner never learns who is buying what.
 */
export function WishRow({
  wish,
  canEdit,
  ownList,
  onUpdate,
  onDelete,
  onSetReceived,
  onClaim,
  onUnclaim,
}: {
  wish: WishData;
  canEdit: boolean;
  ownList: boolean;
  onUpdate: (values: WishFormValues) => void;
  onDelete: () => void;
  onSetReceived: (received: boolean) => void;
  onClaim: () => void;
  onUnclaim: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const received = !!wish.receivedAt;

  if (editing) {
    return (
      <InlineWishRow
        initial={wish}
        onSubmit={(values) => {
          onUpdate(values);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const claimerName = wish.claimedBy ? wish.claimedBy.name || wish.claimedBy.email : null;

  return (
    <div className="group flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-soft px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-hover md:px-6">
      <div className="min-w-0 flex-1 basis-56">
        <div className={`flex items-center gap-2 text-[15px] ${received ? "text-text-faint line-through" : "font-medium"}`}>
          {canEdit && !received ? (
            <InlineEdit
              value={wish.title}
              ariaLabel="Wish"
              onCommit={(title) => onUpdate({ title, url: wish.url, price: wish.price, note: wish.note })}
            />
          ) : (
            <span className="truncate">{wish.title}</span>
          )}
          {wish.url && (
            <a
              href={wish.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[12px] font-medium text-accent no-underline hover:opacity-80"
              aria-label={`Open link for ${wish.title}`}
            >
              Link ↗
            </a>
          )}
        </div>
        {wish.note && <div className="truncate text-[12px] text-text-muted">{wish.note}</div>}
      </div>

      {canEdit && !received ? (
        // Click the price to change it; with none set, a faint "+ price" appears on hover (always on phones).
        <InlineEdit
          value={wish.price !== null ? String(wish.price) : ""}
          editValue={wish.price !== null ? formatEUR(wish.price) : ""}
          display={wish.price !== null ? formatEUR(wish.price) : undefined}
          ariaLabel="Price"
          placeholder="+ price"
          allowEmpty
          maxLength={14}
          onCommit={(text) => {
            // Accepts what was on screen ("€12.50") or a plain number ("12,5").
            const cleaned = text.replace(/[^\d.,]/g, "");
            const parsed = cleaned === "" ? null : Number(cleaned.replace(",", "."));
            if (parsed !== null && !(Number.isFinite(parsed) && parsed >= 0)) return;
            onUpdate({ title: wish.title, url: wish.url, price: parsed, note: wish.note });
          }}
          className={`text-right tabular-nums ${wish.price !== null ? "text-[14px] font-semibold" : "text-[12.5px]"}`}
          buttonClassName={`block ${
            wish.price !== null ? "" : "lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
          }`}
        />
      ) : (
        wish.price !== null && (
          <div className={`text-[14px] font-semibold tabular-nums ${received ? "text-text-faint" : ""}`}>
            {formatEUR(wish.price)}
          </div>
        )
      )}

      <div className="flex items-center gap-3 text-[12.5px] font-medium">
        {!ownList && !received && (
          wish.claimedByMe ? (
            <>
              <span className="rounded-full bg-good/15 px-2.5 py-1 text-good">You&apos;re getting this</span>
              <button type="button" onClick={onUnclaim} className="text-text-muted hover:text-text">
                Unclaim
              </button>
            </>
          ) : claimerName ? (
            <span className="rounded-full border border-border-soft bg-surface-2 px-2.5 py-1 text-text-muted">
              Claimed by {claimerName}
            </span>
          ) : (
            <button
              type="button"
              onClick={onClaim}
              className="rounded-full border border-border px-3.5 py-1.5 text-text hover:border-text"
            >
              I&apos;ll get this
            </button>
          )
        )}
        {!ownList && received && wish.claimedByMe && (
          <span className="rounded-full bg-good/15 px-2.5 py-1 text-good">You gave this</span>
        )}

        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => onSetReceived(!received)}
              className="text-accent hover:opacity-80"
            >
              {received ? "Undo" : "Mark received"}
            </button>
            {!received && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={`Edit ${wish.title}`}
                className="h-4 w-4 text-text-faint hover:text-text"
              >
                <PencilIcon />
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${wish.title}`}
              className="h-4 w-4 text-text-faint hover:text-critical"
            >
              <TrashIcon />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

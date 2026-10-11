"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Button } from "@base-ui/react/button";

import { returnFocusTo, useOpener } from "@/components/ui/focus";

const BACKDROP = "fixed inset-0 bg-black/40 supports-[-webkit-touch-callout:none]:absolute";
const VIEWPORT = "fixed inset-0 flex items-end justify-center p-4 sm:items-center";
const POPUP = "relative w-full max-w-sm rounded-[20px] bg-surface p-5 shadow-2xl outline-none";
const CONFIRM_BUTTON = "flex-1 rounded-xl bg-critical px-4 py-3 text-[14px] font-semibold text-white hover:opacity-90";
const CANCEL_BUTTON = "flex-1 rounded-xl border border-border-soft px-4 py-3 text-[14px] font-medium text-text-muted hover:text-text";

/**
 * Small centred overlay asking "are you sure?" — used instead of the browser's
 * confirm(). Focus starts on Cancel, so the destructive choice is never
 * pre-focused; Escape cancels, a click on the dimmed area does nothing.
 * Imperative call sites use useConfirm() instead.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const opener = useOpener(); // focus goes back to what opened this when it closes

  return (
    <AlertDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <ConfirmPopup
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        onConfirm={onConfirm}
        finalFocus={returnFocusTo(opener)}
      />
    </AlertDialog.Root>
  );
}

/** The overlay, card and two buttons shared by ConfirmDialog and ConfirmProvider. Goes inside an AlertDialog.Root. */
function ConfirmPopup({
  title,
  description,
  confirmLabel,
  onConfirm,
  finalFocus,
}: {
  title?: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
  finalFocus: () => HTMLElement | true;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog.Portal>
      <AlertDialog.Backdrop className={BACKDROP} />
      <AlertDialog.Viewport className={VIEWPORT}>
        <AlertDialog.Popup initialFocus={cancelRef} finalFocus={finalFocus} className={POPUP}>
          <AlertDialog.Title className="text-[16px] font-semibold">{title}</AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-1 text-[13.5px] text-text-muted">{description}</AlertDialog.Description>
          )}
          <div className="mt-5 flex gap-2">
            <Button type="button" onClick={onConfirm} className={CONFIRM_BUTTON}>
              {confirmLabel}
            </Button>
            <AlertDialog.Close ref={cancelRef} className={CANCEL_BUTTON}>
              Cancel
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Viewport>
    </AlertDialog.Portal>
  );
}

export type ConfirmOptions = { title: string; description?: string; confirmLabel?: string };
type Pending = ConfirmOptions & { resolve: (ok: boolean) => void; opener: Element | null };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

/**
 * Mount once near the root. Gives useConfirm() — an awaitable replacement for
 * the browser's confirm(), rendered like ConfirmDialog.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Kept after closing, so the text survives while the dialog is going away.
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // A second question cancels the first; focus still goes back to what opened the first.
        const opener = pendingRef.current ? pendingRef.current.opener : document.activeElement;
        pendingRef.current?.resolve(false);
        const next = { ...options, resolve, opener };
        pendingRef.current = next;
        setPending(next);
        setOpen(true);
      }),
    [],
  );

  function settle(ok: boolean) {
    pendingRef.current?.resolve(ok);
    pendingRef.current = null;
    setOpen(false);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) settle(false);
        }}
      >
        <ConfirmPopup
          title={pending?.title}
          description={pending?.description}
          confirmLabel={pending?.confirmLabel ?? "Delete"}
          onConfirm={() => settle(true)}
          finalFocus={returnFocusTo(pending?.opener ?? null)}
        />
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  );
}

/** `if (!(await confirm({ title: "Delete X?" }))) return;` — resolves true on confirm, false on Cancel/Escape. */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}

"use client";

import { useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";

import { openerOf } from "@/components/ui/focus";

const FIRST_FIELD =
  "[autofocus], input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])";

/**
 * A dialog over a dimmed page, for forms that deserve the whole focus: a
 * centred card on desktop, a sheet from the bottom on a phone. Escape, the ✕
 * or a click on the dimmed area closes it. The page behind doesn't scroll.
 * Focus moves into the dialog: to its first form field when opened from the
 * keyboard, to the dialog itself when opened by pointer or touch.
 */
export function Modal({
  title,
  onClose,
  children,
  width = "max-w-xl",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  // Focus goes back to what opened this when it closes.
  const [opener] = useState(() => (typeof document === "undefined" ? null : document.activeElement));

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40 supports-[-webkit-touch-callout:none]:absolute" />
        <Dialog.Viewport className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-6">
          <Dialog.Popup
            ref={popupRef}
            finalFocus={openerOf(opener)}
            initialFocus={(openType) => {
              const popup = popupRef.current;
              if (!popup) return null;
              // A field React already autofocused keeps it.
              const active = document.activeElement;
              if (active instanceof HTMLElement && active !== popup && popup.contains(active)) return active;
              // From the keyboard, the first field. By pointer or touch, the dialog itself: no field lights up
              // that didn't before, and on a phone the on-screen keyboard stays closed. Tab then reaches the fields.
              return openType === "keyboard" ? (popup.querySelector<HTMLElement>(FIRST_FIELD) ?? popup) : popup;
            }}
            className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[24px] bg-surface shadow-2xl outline-none sm:rounded-[24px] ${width}`}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <Dialog.Title className="font-display text-[20px] font-bold tracking-tight">{title}</Dialog.Title>
              <Dialog.Close
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text"
              >
                ✕
              </Dialog.Close>
            </div>
            <div className="overflow-y-auto px-6 pt-3">{children}</div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * The button row of a form inside a Modal. It stays pinned to the bottom of
 * the dialog while the content above it scrolls, so "Save" or "Import" is
 * always in reach.
 */
export function ModalFooter({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`sticky bottom-0 z-10 -mx-6 mt-6 flex items-center gap-3 border-t border-border-soft bg-surface px-6 py-4 ${className}`}
    >
      {children}
    </div>
  );
}

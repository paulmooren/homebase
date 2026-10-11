import { useState } from "react";

/**
 * The element that had focus when the calling component first mounted (the button that was pressed), read
 * once and only on the client. Pass it to `returnFocusTo` for a pop-up's `finalFocus`.
 */
export function useOpener() {
  const [opener] = useState(() => (typeof document === "undefined" ? null : document.activeElement));
  return opener;
}

/**
 * Where focus should go when a pop-up closes: the element that had it when the pop-up opened (the button
 * that was pressed), if it is still on the page. Base UI can only work this out for pop-ups opened by one of
 * its own triggers; ours are shown by rendering them, so we remember the opener ourselves.
 */
export function returnFocusTo(active: Element | null) {
  return () => (active instanceof HTMLElement && active !== document.body && active.isConnected ? active : true);
}

/**
 * Whether the pop-up was opened from the keyboard: the button that opened it shows a keyboard focus ring
 * (`:focus-visible`), which a mouse or touch press on a button does not. Base UI cannot say, for a pop-up that is
 * rendered already open, so we ask the opener ourselves.
 */
export function openedByKeyboard(opener: Element | null) {
  return opener instanceof HTMLElement && opener.matches(":focus-visible");
}

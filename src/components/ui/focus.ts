/**
 * Where focus should go when a pop-up closes: the element that had it when the pop-up opened (the button
 * that was pressed), if it is still on the page. Base UI can only work this out for pop-ups opened by one of
 * its own triggers; ours are shown by rendering them, so we remember the opener ourselves.
 */
export function openerOf(active: Element | null) {
  return () => (active instanceof HTMLElement && active !== document.body && active.isConnected ? active : true);
}

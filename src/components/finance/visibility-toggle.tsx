/**
 * Inline visibility control for a personally-owned row (account, recurring
 * item, or budget). Only ever shown for rows the viewer owns — shared rows
 * have no visibility concept, they're always visible by definition. A
 * read-only indicator (not this control) is what non-owners see instead.
 */
export function VisibilityToggle({
  visible,
  onChange,
  pending,
}: {
  visible: boolean;
  onChange: (visible: boolean) => void;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!visible)}
      disabled={pending}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-60 ${
        visible
          ? "border-border-soft bg-surface-2 text-text-muted hover:text-text"
          : "border-border-soft bg-surface-2 text-text-faint hover:text-text"
      }`}
      title={visible ? "Visible to household — click to make private" : "Private — click to share the view"}
    >
      {visible ? "Visible to household" : "Private"}
    </button>
  );
}

/** Read-only indicator for a row someone else owns, shown only when visible (invisible rows never appear in another member's view at all). */
export function VisibilityBadge() {
  return (
    <span className="rounded-full border border-border-soft bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-text-faint">
      Visible to you
    </span>
  );
}

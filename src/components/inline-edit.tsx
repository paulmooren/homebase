"use client";

import { useRef, useState } from "react";

/**
 * Text you can click to edit right where it is. Clicking only selects the text:
 * the field has no background, border or padding and grows with what you type,
 * so nothing around it moves. Enter or blur saves, Escape cancels. An empty
 * save is ignored unless `allowEmpty`.
 *
 * `className` styles the text itself (size, weight, alignment) in both modes;
 * `buttonClassName` is only the resting layout (truncation, hover reveal…).
 */
export function InlineEdit({
  value,
  editValue,
  onCommit,
  ariaLabel,
  placeholder,
  display,
  allowEmpty,
  maxLength = 120,
  className = "",
  buttonClassName = "block max-w-full truncate text-left",
}: {
  value: string;
  /** What the field starts with when it opens, if it differs from `value` (e.g. the "€12.00" that was on screen for "12"). */
  editValue?: string;
  onCommit: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  /** What to show while not editing, if it differs from the raw value. */
  display?: React.ReactNode;
  allowEmpty?: boolean;
  maxLength?: number;
  className?: string;
  buttonClassName?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);

  if (draft !== null) {
    return (
      // The hidden copy of the text sizes the box, so the field is exactly as wide as what's shown.
      <span className="grid w-fit max-w-full min-w-0">
        <span
          aria-hidden
          className={`invisible col-start-1 row-start-1 overflow-hidden whitespace-pre ${className}`}
        >
          {draft || placeholder || " "}
        </span>
        <input
          ref={(el) => {
            // On open: focus and select everything, so the text is simply highlighted.
            if (el && document.activeElement !== el) {
              el.focus();
              el.select();
            }
          }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={maxLength}
          aria-label={ariaLabel}
          placeholder={placeholder}
          className={`col-start-1 row-start-1 m-0 w-0 min-w-full border-0 bg-transparent p-0 outline-none placeholder:text-text-faint ${className}`}
          onBlur={(e) => {
            const next = e.target.value.trim();
            setDraft(null);
            if (cancelled.current) {
              cancelled.current = false;
              return;
            }
            if ((next || allowEmpty) && next !== value && next !== (editValue ?? value)) onCommit(next);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              cancelled.current = true;
              e.currentTarget.blur();
            }
          }}
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setDraft(editValue ?? value)}
      aria-label={`${ariaLabel}: ${value || "empty"}, click to change`}
      className={`${buttonClassName} ${className}`}
    >
      {value ? (display ?? value) : <span className="text-text-faint">{placeholder}</span>}
    </button>
  );
}

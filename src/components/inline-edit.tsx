"use client";

import { useState } from "react";

/** Text that turns into an input when clicked. Enter or blur saves, Escape cancels. Empty saves are ignored unless `allowEmpty`. */
export function InlineEdit({
  value,
  onCommit,
  ariaLabel,
  placeholder,
  display,
  allowEmpty,
  maxLength = 120,
  className = "",
  inputClassName = "",
}: {
  value: string;
  onCommit: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  /** What to show while not editing, if it differs from the raw value (e.g. "€12.00" for "12"). */
  display?: React.ReactNode;
  allowEmpty?: boolean;
  maxLength?: number;
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        defaultValue={value}
        autoFocus
        maxLength={maxLength}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className={`w-full rounded-md bg-surface-2 px-1.5 py-0.5 outline-none ${inputClassName || className}`}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => {
          setEditing(false);
          const next = e.target.value.trim();
          if ((next || allowEmpty) && next !== value) onCommit(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = value;
            e.currentTarget.blur();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`${ariaLabel}: ${value || "empty"}, click to change`}
      className={`block max-w-full truncate text-left ${className}`}
    >
      {value ? (display ?? value) : <span className="text-text-faint">{placeholder}</span>}
    </button>
  );
}

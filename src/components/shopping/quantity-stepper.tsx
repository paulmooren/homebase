"use client";

import { useState } from "react";

/** "2" → {2, ""}, "500 g" → {500, "g"}, "1,5 kg" → {1.5, "kg"}; anything else isn't steppable. */
function parseAmount(value: string) {
  const m = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return null;
  return { num: parseFloat(m[1].replace(",", ".")), comma: m[1].includes(","), unit: m[2] };
}

/** One step up or down; going to zero clears the amount (null). Grams and millilitres move in 50s. */
export function stepAmount(value: string, direction: 1 | -1): string | null {
  const parsed = parseAmount(value);
  if (!parsed) return value;
  const step = /^(g|gr|gram|ml)$/i.test(parsed.unit) ? 50 : 1;
  const next = Math.round((parsed.num + direction * step) * 100) / 100;
  if (next <= 0) return null;
  let text = String(next);
  if (parsed.comma) text = text.replace(".", ",");
  return parsed.unit ? `${text} ${parsed.unit}` : text;
}

/**
 * − 2 L + : change the amount without opening an edit form. Click the amount
 * itself to type something else ("500 g", "a bit"). No amount yet: a quiet
 * "+" sets it to 1. Amounts that aren't a number just show as text.
 */
export function QuantityStepper({
  value,
  onChange,
  muted,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  muted?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const steppable = value !== null && parseAmount(value) !== null;

  const stepButton = "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[16px] leading-none text-text-muted hover:bg-surface-2 hover:text-text";

  if (editing) {
    return (
      <input
        defaultValue={value ?? ""}
        autoFocus
        maxLength={30}
        aria-label="Amount"
        placeholder="Amount"
        className="w-20 rounded-lg border border-border-soft bg-surface px-2 py-1 text-right text-[14px] tabular-nums outline-none focus:border-accent"
        onBlur={(e) => {
          setEditing(false);
          const next = e.target.value.trim() || null;
          if (next !== value) onChange(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = value ?? "";
            e.currentTarget.blur();
          }
        }}
      />
    );
  }

  if (value === null) {
    return (
      <button
        type="button"
        onClick={() => onChange("1")}
        aria-label="Add an amount"
        className={`${stepButton} text-text-faint`}
      >
        +
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center">
      {steppable && (
        <button type="button" onClick={() => onChange(stepAmount(value, -1))} aria-label="One less" className={stepButton}>
          −
        </button>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Amount ${value}, click to change`}
        className={`min-w-8 px-1 text-center text-[14px] tabular-nums ${muted ? "text-text-faint" : "text-text"}`}
      >
        {value}
      </button>
      {steppable && (
        <button type="button" onClick={() => onChange(stepAmount(value, 1))} aria-label="One more" className={stepButton}>
          +
        </button>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

/**
 * An amount is "<number> <unit>": "2" → 2, "500 g" → 500 g, "1,5 kg" → 1.5 kg.
 * No number means one of it: nothing at all is 1, "a bit" is 1 "a bit".
 */
export function parseAmount(value: string | null): { num: number; unit: string; comma: boolean } {
  const m = (value ?? "").trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return { num: 1, unit: (value ?? "").trim(), comma: false };
  return { num: parseFloat(m[1].replace(",", ".")), unit: m[2], comma: m[1].includes(",") };
}

function formatAmount(num: number, unit: string, comma: boolean): string | null {
  if (num === 1 && !unit) return null;
  let text = String(num);
  if (comma) text = text.replace(".", ",");
  return unit ? `${text} ${unit}` : text;
}

/** One step up or down; grams and millilitres move in 50s. Returns "remove" when it would reach zero. */
export function stepAmount(value: string | null, direction: 1 | -1): string | null | "remove" {
  const { num, unit, comma } = parseAmount(value);
  const step = /^(g|gr|gram|ml)$/i.test(unit) ? 50 : 1;
  const next = Math.round((num + direction * step) * 100) / 100;
  if (next <= 0) return "remove";
  return formatAmount(next, unit, comma);
}

/**
 * − 2 + at the start of a row. Pressing − at the lowest amount asks to remove
 * the item (`onRemove`). Click the number to type any amount ("500 g").
 */
export function QuantityPill({
  value,
  onChange,
  onRemove,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { num, comma } = parseAmount(value);
  const shown = comma ? String(num).replace(".", ",") : String(num);

  const stepButton =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[18px] leading-none text-text hover:bg-border-soft";

  return (
    <div className="flex shrink-0 items-center rounded-full bg-surface-2 p-0.5">
      <button
        type="button"
        aria-label="One less"
        onClick={() => {
          const next = stepAmount(value, -1);
          if (next === "remove") onRemove();
          else onChange(next);
        }}
        className={stepButton}
      >
        −
      </button>
      {editing ? (
        <input
          defaultValue={value ?? "1"}
          autoFocus
          maxLength={30}
          aria-label="Amount"
          className="w-16 bg-transparent text-center text-[15px] font-semibold tabular-nums outline-none"
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => {
            setEditing(false);
            const typed = e.target.value.trim();
            const next = typed === "" || typed === "1" ? null : typed;
            if (next !== value) onChange(next);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.currentTarget.value = value ?? "1";
              e.currentTarget.blur();
            }
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Amount ${value ?? "1"}, click to change`}
          className="min-w-7 px-1 text-center text-[15px] font-semibold tabular-nums"
        >
          {shown}
        </button>
      )}
      <button type="button" aria-label="One more" onClick={() => onChange(stepAmount(value, 1) as string | null)} className={stepButton}>
        +
      </button>
    </div>
  );
}

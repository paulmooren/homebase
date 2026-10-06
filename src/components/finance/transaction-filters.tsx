"use client";

import { useEffect, useRef, useState } from "react";

import { formatEUR } from "@/lib/format";
import { parseMoney } from "@/lib/money";
import type { Category } from "@/components/finance/category-cell";

/** Dates are "YYYY-MM-DD"; `categoryIds` may include "none" for uncategorized. Amounts are absolute (no minus sign). */
export type TransactionFilters = {
  from?: string;
  to?: string;
  /** Label for a preset range, shown instead of the raw dates. */
  dateLabel?: string;
  categoryIds: string[];
  minAmount?: number;
  maxAmount?: number;
};

export const NO_FILTERS: TransactionFilters = { categoryIds: [] };

export function hasFilters(f: TransactionFilters) {
  return !!(f.from || f.to || f.categoryIds.length || f.minAmount !== undefined || f.maxAmount !== undefined);
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const PRESETS: { label: string; range: () => { from: string; to: string } }[] = [
  {
    label: "Last 7 days",
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return { from: iso(from), to: iso(to) };
    },
  },
  {
    label: "Last 30 days",
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { from: iso(from), to: iso(to) };
    },
  },
  {
    label: "This month",
    range: () => {
      const now = new Date();
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    },
  },
  {
    label: "Last month",
    range: () => {
      const now = new Date();
      return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
    },
  },
  {
    label: "Last 3 months",
    range: () => {
      const now = new Date();
      return { from: iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: iso(now) };
    },
  },
  {
    label: "This year",
    range: () => {
      const now = new Date();
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(new Date(now.getFullYear(), 11, 31)) };
    },
  },
];

const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

function dateSummary(f: TransactionFilters) {
  if (f.dateLabel) return f.dateLabel;
  if (f.from && f.to) return `${shortDate(f.from)} – ${shortDate(f.to)}`;
  if (f.from) return `From ${shortDate(f.from)}`;
  if (f.to) return `Until ${shortDate(f.to)}`;
  return "";
}

function amountSummary(f: TransactionFilters) {
  const { minAmount: min, maxAmount: max } = f;
  if (min !== undefined && max !== undefined) return `${formatEUR(min)} – ${formatEUR(max)}`;
  if (min !== undefined) return `At least ${formatEUR(min)}`;
  if (max !== undefined) return `Up to ${formatEUR(max)}`;
  return "";
}

/**
 * Filter chips for the transaction list — Date, Category, Amount — in the same
 * pill style as the account filter. Each opens a small panel; a filter that is
 * on shows its value in the chip, with ✕ to clear it.
 */
export function TransactionFilterBar({
  filters,
  onChange,
  categories,
}: {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  categories: Category[];
}) {
  const [open, setOpen] = useState<"date" | "category" | "amount" | null>(null);

  const dateOn = !!(filters.from || filters.to);
  const categoryOn = filters.categoryIds.length > 0;
  const amountOn = filters.minAmount !== undefined || filters.maxAmount !== undefined;

  const categoryNames = filters.categoryIds.map((id) =>
    id === "none" ? "No category" : (categories.find((c) => c.id === id)?.name ?? "…"),
  );
  const categorySummary =
    categoryNames.length > 1 ? `${categoryNames[0]} +${categoryNames.length - 1}` : (categoryNames[0] ?? "");

  return (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-2" role="group" aria-label="Filter transactions">
      <FilterChipWithPanel
        label="Date"
        summary={dateOn ? dateSummary(filters) : ""}
        active={dateOn}
        open={open === "date"}
        onOpen={(o) => setOpen(o ? "date" : null)}
        onClear={() => onChange({ ...filters, from: undefined, to: undefined, dateLabel: undefined })}
      >
        <DatePanel
          filters={filters}
          onApply={(range) => {
            onChange({ ...filters, ...range });
            setOpen(null);
          }}
        />
      </FilterChipWithPanel>

      <FilterChipWithPanel
        label="Category"
        summary={categoryOn ? categorySummary : ""}
        active={categoryOn}
        open={open === "category"}
        onOpen={(o) => setOpen(o ? "category" : null)}
        onClear={() => onChange({ ...filters, categoryIds: [] })}
      >
        <div className="max-h-72 overflow-y-auto py-1">
          {[{ id: "none", name: "No category", color: "#c7c9cf" }, ...categories].map((c) => {
            const checked = filters.categoryIds.includes(c.id);
            return (
              <label key={c.id} className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2 text-[13.5px] hover:bg-surface-hover">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange({
                      ...filters,
                      categoryIds: checked ? filters.categoryIds.filter((id) => id !== c.id) : [...filters.categoryIds, c.id],
                    })
                  }
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span className="block h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                {c.name}
              </label>
            );
          })}
        </div>
      </FilterChipWithPanel>

      <FilterChipWithPanel
        label="Amount"
        summary={amountOn ? amountSummary(filters) : ""}
        active={amountOn}
        open={open === "amount"}
        onOpen={(o) => setOpen(o ? "amount" : null)}
        onClear={() => onChange({ ...filters, minAmount: undefined, maxAmount: undefined })}
      >
        <AmountPanel
          filters={filters}
          onApply={(range) => {
            onChange({ ...filters, ...range });
            setOpen(null);
          }}
        />
      </FilterChipWithPanel>

      {hasFilters(filters) && (
        <button
          type="button"
          onClick={() => {
            onChange(NO_FILTERS);
            setOpen(null);
          }}
          className="px-1 text-[12.5px] font-medium text-text-muted hover:text-text"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function DatePanel({
  filters,
  onApply,
}: {
  filters: TransactionFilters;
  onApply: (range: { from?: string; to?: string; dateLabel?: string }) => void;
}) {
  return (
    <div className="w-72 p-1">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onApply({ ...p.range(), dateLabel: p.label })}
          className="block w-full rounded-lg px-3 py-2 text-left text-[13.5px] hover:bg-surface-hover"
        >
          {p.label}
        </button>
      ))}
      <form
        className="mt-1 border-t border-border-soft p-3"
        onSubmit={(e) => {
          e.preventDefault();
          // Uncontrolled date inputs, read on submit — typing a year isn't fought by React.
          const form = new FormData(e.currentTarget);
          const from = String(form.get("from") ?? "") || undefined;
          const to = String(form.get("to") ?? "") || undefined;
          onApply({ from, to, dateLabel: undefined });
        }}
      >
        <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-text-faint uppercase">Custom range</p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            name="from"
            aria-label="From"
            defaultValue={filters.dateLabel ? "" : (filters.from ?? "")}
            className="min-w-0 flex-1 rounded-lg border border-border-soft bg-surface px-2.5 py-2 text-[13px] outline-none focus:border-accent"
          />
          <span className="text-text-faint">–</span>
          <input
            type="date"
            name="to"
            aria-label="To"
            defaultValue={filters.dateLabel ? "" : (filters.to ?? "")}
            className="min-w-0 flex-1 rounded-lg border border-border-soft bg-surface px-2.5 py-2 text-[13px] outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          className="mt-3 w-full rounded-lg bg-accent-fill px-4 py-2 text-[13px] font-semibold text-accent-ink hover:opacity-90"
        >
          Apply
        </button>
      </form>
    </div>
  );
}

function AmountPanel({
  filters,
  onApply,
}: {
  filters: TransactionFilters;
  onApply: (range: { minAmount?: number; maxAmount?: number }) => void;
}) {
  const read = (form: FormData, name: string) => {
    const raw = String(form.get(name) ?? "").trim();
    if (!raw) return undefined;
    const value = parseMoney(raw);
    return value !== null && value >= 0 ? value : undefined;
  };

  return (
    <form
      className="w-72 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        onApply({ minAmount: read(form, "min"), maxAmount: read(form, "max") });
      }}
    >
      <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-text-faint uppercase">Amount</p>
      <div className="flex items-center gap-2">
        <input
          name="min"
          aria-label="Minimum amount"
          placeholder="Min €"
          inputMode="decimal"
          defaultValue={filters.minAmount ?? ""}
          className="min-w-0 flex-1 rounded-lg border border-border-soft bg-surface px-2.5 py-2 text-[13px] tabular-nums outline-none placeholder:text-text-faint focus:border-accent"
        />
        <span className="text-text-faint">–</span>
        <input
          name="max"
          aria-label="Maximum amount"
          placeholder="Max €"
          inputMode="decimal"
          defaultValue={filters.maxAmount ?? ""}
          className="min-w-0 flex-1 rounded-lg border border-border-soft bg-surface px-2.5 py-2 text-[13px] tabular-nums outline-none placeholder:text-text-faint focus:border-accent"
        />
      </div>
      <p className="mt-2 text-[11.5px] text-text-muted">Income and expenses alike, ignoring the minus sign.</p>
      <button
        type="submit"
        className="mt-3 w-full rounded-lg bg-accent-fill px-4 py-2 text-[13px] font-semibold text-accent-ink hover:opacity-90"
      >
        Apply
      </button>
    </form>
  );
}

/**
 * A pill that opens a floating panel. The panel is positioned with `fixed`
 * from the pill's own position, so the card around the list (which clips its
 * overflow) can't cut it off; it closes on outside click, Escape or scroll.
 */
function FilterChipWithPanel({
  label,
  summary,
  active,
  open,
  onOpen,
  onClear,
  children,
}: {
  label: string;
  summary: string;
  active: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 8, left: Math.max(8, Math.min(rect.left, window.innerWidth - 300)) });
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpen(false);
    const onScroll = () => onOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <span
        className={`inline-flex h-8 items-center rounded-full border text-[13px] font-medium transition-colors ${
          active ? "border-text bg-text text-bg" : "border-transparent bg-surface-2 text-text-muted hover:bg-border-soft hover:text-text"
        }`}
      >
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => onOpen(!open)}
          className={`inline-flex h-full items-center gap-1.5 pl-3.5 ${active ? "pr-1.5" : "pr-3.5"}`}
        >
          {label}
          {active && summary && <span className="max-w-[180px] truncate text-bg/80">· {summary}</span>}
        </button>
        {active && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${label.toLowerCase()} filter`}
            className="mr-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] text-bg/80 hover:bg-white/15"
          >
            ✕
          </button>
        )}
      </span>
      {open && pos && (
        <div
          role="dialog"
          aria-label={`${label} filter`}
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="z-50 overflow-hidden rounded-xl border border-border-soft bg-surface shadow-xl"
        >
          {children}
        </div>
      )}
    </div>
  );
}

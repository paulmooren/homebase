"use client";

import { useState } from "react";

import { trpc } from "@/trpc/react";

/** Type-and-enter box with suggestions from items the household has added before. */
export function AddItemInput({
  listId,
  onAdd,
  autoFocus,
}: {
  listId: string;
  onAdd: (name: string) => void;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const query = value.trim();
  const { data: suggestions } = trpc.shopping.suggest.useQuery(
    { listId, q: query },
    { enabled: query.length > 0 },
  );
  const showSuggestions = focused && query.length > 0 && (suggestions?.length ?? 0) > 0;

  function submit(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
  }

  return (
    <form
      className="relative flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        maxLength={120}
        placeholder="Add an item…"
        aria-label="Add an item"
        autoComplete="off"
        enterKeyHint="done"
        className="min-w-0 flex-1 rounded-xl border border-border-soft bg-surface px-3.5 py-3 text-[15px] outline-none transition-colors placeholder:text-text-faint focus:border-accent"
      />
      <button
        type="submit"
        disabled={!query}
        className="rounded-xl bg-accent-fill px-5 py-3 text-[13.5px] font-semibold text-accent-ink hover:opacity-90 disabled:bg-surface-2 disabled:text-text-faint"
      >
        Add
      </button>

      {showSuggestions && (
        <ul className="absolute top-full right-0 left-0 z-20 mt-1.5 overflow-hidden rounded-xl border border-border-soft bg-surface shadow-lg">
          {suggestions?.map((name) => (
            <li key={name}>
              {/* onMouseDown so the pick lands before the input's blur hides the list */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  submit(name);
                }}
                className="block w-full px-3.5 py-2.5 text-left text-[14px] hover:bg-surface-hover"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

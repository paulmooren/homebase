"use client";

import { useRef, useState } from "react";

import { trpc } from "@/trpc/react";
import { CheckIcon, CloseIcon, PlusIcon } from "@/components/action-icons";

/**
 * "+ Add item" at the bottom of the list, same pattern as the other lists in
 * the app. Opens into a new line; Enter adds the item and leaves a fresh line
 * open so a whole shop can be typed in one go. Past items are suggested. The
 * amount is set afterwards with the −/+ on the item.
 */
export function AddItemRow({
  listId,
  onAdd,
}: {
  listId: string;
  onAdd: (item: { name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [focused, setFocused] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const query = name.trim();
  const { data: suggestions } = trpc.shopping.suggest.useQuery(
    { listId, q: query },
    { enabled: open && query.length > 0 },
  );
  const showSuggestions = focused && query.length > 0 && (suggestions?.length ?? 0) > 0;

  function submit(picked?: string) {
    const finalName = (picked ?? name).trim();
    if (!finalName) return;
    onAdd({ name: finalName });
    setName("");
    nameRef.current?.focus();
  }

  function close() {
    setOpen(false);
    setName("");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 border-b border-border-soft px-4 py-3.5 text-left text-text-faint transition-colors last:rounded-b-[20px] last:border-b-0 hover:text-text md:px-6"
      >
        <span className="block h-2.5 w-2.5 shrink-0">
          <PlusIcon />
        </span>
        <span className="text-[14px]">Add item</span>
      </button>
    );
  }

  return (
    <form
      className="relative flex items-center gap-3 border-b border-border-soft bg-surface px-4 py-2.5 last:rounded-b-[20px] last:border-b-0 md:px-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <span className="block h-7 w-7 shrink-0 rounded-lg border border-dashed border-border" aria-hidden />
      <input
        ref={nameRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus
        maxLength={120}
        placeholder="Item"
        aria-label="Item"
        autoComplete="off"
        enterKeyHint="done"
        className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-text-faint"
      />
      <button type="submit" aria-label="Add item" className="h-4 w-4 shrink-0 text-good hover:opacity-80">
        <CheckIcon />
      </button>
      <button
        type="button"
        onClick={close}
        aria-label="Done adding"
        className="h-4 w-4 shrink-0 text-text-muted hover:text-critical"
      >
        <CloseIcon />
      </button>

      {showSuggestions && (
        <ul className="absolute top-full right-4 left-4 z-20 mt-1 overflow-hidden rounded-xl border border-border-soft bg-surface shadow-lg md:right-6 md:left-6">
          {suggestions?.map((suggestion) => (
            <li key={suggestion}>
              {/* onMouseDown so the pick lands before the input's blur hides the list */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  submit(suggestion);
                }}
                className="block w-full px-3.5 py-2.5 text-left text-[14px] hover:bg-surface-hover"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

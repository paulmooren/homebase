"use client";

import { useState } from "react";

import { TrashIcon } from "@/components/action-icons";
import { InlineEdit } from "@/components/inline-edit";
import { SECTION_PREFIX, SortableBoard, SortableList, SortableSection, type BoardDrop } from "@/components/sortable-list";
import { monthlyOf, type BudgetItem, type Entry } from "@/lib/budget-scope";
import { formatEUR } from "@/lib/format";

export type BudgetGroup = { id: string; name: string };

type GroupedItem = BudgetItem & { budgetGroupId: string | null };

const OTHER = `${SECTION_PREFIX}other`;

/**
 * The expenses of one owner group, split into the household's Budget groups —
 * Rent, Insurances, Savings — each with its subtotal, and what has no group
 * under "Other". Rows can be dragged within a section to reorder, or into
 * another to change group.
 *
 * Only groups that hold something here are shown, plus a brand-new group
 * (used by nothing yet) in `hostsFresh`, so there is somewhere to drop the
 * first item. With no groups at all it is just the plain list.
 */
export function ExpenseSections<T extends GroupedItem>({
  entries,
  groups,
  usedGroupIds,
  hostsFresh,
  renderRow,
  onReorder,
  onMove,
  onRename,
  onDelete,
}: {
  entries: Entry<T>[];
  groups: BudgetGroup[];
  /** Groups that hold at least one item anywhere in the household. */
  usedGroupIds: Set<string>;
  hostsFresh: boolean;
  renderRow: (entry: Entry<T>) => React.ReactNode;
  onReorder: (ids: string[]) => void;
  onMove: (move: { id: string; groupId: string | null; ids: string[] }) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const known = new Set(groups.map((g) => g.id));
  const sections: { id: string; group: BudgetGroup | null; entries: Entry<T>[] }[] = [];
  for (const group of groups) {
    const inGroup = entries.filter((e) => e.item.budgetGroupId === group.id);
    if (inGroup.length > 0 || (hostsFresh && !usedGroupIds.has(group.id))) {
      sections.push({ id: `${SECTION_PREFIX}${group.id}`, group, entries: inGroup });
    }
  }
  const other = entries.filter((e) => !e.item.budgetGroupId || !known.has(e.item.budgetGroupId));
  if (other.length > 0) sections.push({ id: OTHER, group: null, entries: other });

  // Nothing to tell apart: the plain list.
  if (sections.length === 0 || (sections.length === 1 && sections[0].group === null)) {
    return (
      <SortableList ids={entries.map((e) => e.item.id)} onReorder={onReorder}>
        {entries.map(renderRow)}
      </SortableList>
    );
  }

  function handleDrop({ id, from, to, ids }: BoardDrop) {
    if (from === to) onReorder(ids);
    else onMove({ id, groupId: to === OTHER ? null : to.slice(SECTION_PREFIX.length), ids });
  }

  return (
    <SortableBoard sections={sections.map((s) => ({ id: s.id, ids: s.entries.map((e) => e.item.id) }))} onDrop={handleDrop}>
      {sections.map((section) => (
        <div key={section.id}>
          <div className="group/heading flex items-baseline justify-between gap-3 px-6 pt-4 pb-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {section.group ? (
                <>
                  <InlineEdit
                    value={section.group.name}
                    ariaLabel="Group name"
                    maxLength={60}
                    onCommit={(name) => name.trim() && name.trim() !== section.group!.name && onRename(section.group!.id, name.trim())}
                    className="text-[12.5px] font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete the group “${section.group!.name}”? Its items stay, under Other.`)) onDelete(section.group!.id);
                    }}
                    aria-label={`Delete group ${section.group.name}`}
                    title="Delete group"
                    className="h-3.5 w-3.5 shrink-0 text-text-faint hover:text-critical"
                  >
                    <TrashIcon />
                  </button>
                </>
              ) : (
                <span className="text-[12.5px] font-semibold text-text-muted">Other</span>
              )}
            </div>
            {section.entries.length > 0 && (
              <p className="shrink-0 text-[11px] text-text-muted tabular-nums">
                {formatEUR(section.entries.reduce((sum, e) => sum + monthlyOf(e.item), 0))} / mo
              </p>
            )}
          </div>
          <SortableSection
            id={section.id}
            ids={section.entries.map((e) => e.item.id)}
            empty={<p className="px-6 py-3 text-[12.5px] text-text-faint">Drag an item here, or choose this group when you edit one.</p>}
          >
            {section.entries.map(renderRow)}
          </SortableSection>
        </div>
      ))}
    </SortableBoard>
  );
}

/** "Add group": one click to a name field, Enter to create. */
export function AddGroup({ onAdd, error }: { onAdd: (name: string) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-6 py-3 text-left text-[12.5px] text-text-faint transition-colors hover:text-text"
      >
        + Add group
      </button>
    );
  }
  return (
    <form
      className="flex items-center gap-2 px-6 py-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name.trim());
        setName("");
        setOpen(false);
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        placeholder="Group name, e.g. Insurances"
        aria-label="New group name"
        className="min-w-0 flex-1 rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-text-faint"
      />
      <button type="submit" className="rounded-lg bg-accent-fill px-3 py-1.5 text-[12.5px] font-semibold text-accent-ink">
        Add
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-[12.5px] text-text-muted hover:text-text">
        Cancel
      </button>
      {error && <span className="text-[12px] text-critical">{error}</span>}
    </form>
  );
}

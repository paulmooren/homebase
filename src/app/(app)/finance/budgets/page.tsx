"use client";

import { useState } from "react";

import { trpc } from "@/trpc/react";
import { formatEUR, formatSignedEUR, formatDate } from "@/lib/format";
import { RECURRING_FREQUENCY_LABELS, type RecurringFrequency } from "@/lib/constants";
import { monthlyEquivalent } from "@/lib/recurring";
import { PencilIcon, TrashIcon, PlusIcon, CloseIcon, CheckIcon, ChevronDownIcon } from "@/components/action-icons";
import { groupOrder, groupLabel, type Member } from "@/components/finance/ownership-groups";
import { VisibilityToggle, VisibilityBadge } from "@/components/finance/visibility-toggle";

const FREQUENCIES = Object.keys(RECURRING_FREQUENCY_LABELS) as RecurringFrequency[];

type TxType = "EXPENSE" | "INCOME";

type Candidate = {
  name: string;
  type: TxType;
  amount: number;
  frequency: RecurringFrequency;
  occurrences: number;
  lastDate: string | Date;
  nextDueDate: string | Date;
  categoryId: string | null;
  ownerId: string | null;
};

type Item = {
  id: string;
  name: string;
  type: TxType;
  amount: number;
  frequency: RecurringFrequency;
  source: "MANUAL" | "DETECTED";
  nextDueDate: string | Date | null;
  categoryId: string | null;
  category: { color: string; name: string } | null;
  ownerId: string | null;
  visibleToHousehold: boolean;
};

type FormValues = {
  name: string;
  amount: number;
  frequency: RecurringFrequency;
  categoryId: string | null;
  ownerId: string | null;
};

export default function BudgetsPage() {
  const { data: household } = trpc.household.current.useQuery();
  const { data: me } = trpc.user.me.useQuery();
  const members: Member[] = household?.members ?? [];
  const currentUserId = me?.id ?? "";

  return (
    <div className="flex flex-col gap-5">
      <RecurringItems members={members} currentUserId={currentUserId} />
    </div>
  );
}

/** "You" first, then other household members in join order, "Shared" last. */
function RecurringItems({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const utils = trpc.useUtils();
  const { data: items } = trpc.recurring.list.useQuery();
  const { data: suggestions } = trpc.recurring.suggestions.useQuery();
  const { data: categories } = trpc.category.list.useQuery();

  const invalidate = () => {
    utils.recurring.list.invalidate();
    utils.recurring.suggestions.invalidate();
  };

  const createItem = trpc.recurring.create.useMutation({ onSuccess: invalidate });
  const updateItem = trpc.recurring.update.useMutation({ onSuccess: invalidate });
  const confirmSuggestion = trpc.recurring.confirmSuggestion.useMutation({ onSuccess: invalidate });
  const dismissSuggestion = trpc.recurring.dismissSuggestion.useMutation({ onSuccess: invalidate });
  const deleteItem = trpc.recurring.delete.useMutation({ onSuccess: invalidate });

  const multiMember = members.length > 1;

  const income = (items?.filter((i) => i.type === "INCOME") ?? []) as Item[];
  const expenses = (items?.filter((i) => i.type === "EXPENSE") ?? []) as Item[];
  const monthlyIncome = income.reduce((sum, i) => sum + monthlyEquivalent(i.amount, i.frequency), 0);
  const monthlyExpenses = expenses.reduce((sum, i) => sum + monthlyEquivalent(i.amount, i.frequency), 0);

  return (
    <>
      {multiMember ? (
        <SummaryStrip income={income} expenses={expenses} members={members} currentUserId={currentUserId} />
      ) : (
        items &&
        items.length > 0 && (
          <div className="flex flex-wrap items-baseline justify-end gap-4">
            <div className="text-right">
              <p className="mb-1 text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
                Net recurring / month
              </p>
              <p
                className={`font-serif text-[32px] tabular-nums ${
                  monthlyIncome - monthlyExpenses < 0 ? "text-critical" : "text-good"
                }`}
              >
                {formatSignedEUR(monthlyIncome - monthlyExpenses)}
              </p>
            </div>
          </div>
        )
      )}

      {suggestions && suggestions.length > 0 && (
        <section className="rounded-[20px] border border-border-soft bg-surface p-6">
          <h2 className="mb-1 text-[15px] font-semibold">Suggestions</h2>
          <p className="mb-4 text-[13px] text-text-muted">
            Detected from your transaction history — confirm the ones that are
            genuinely recurring.
          </p>
          {suggestions.map((c: Candidate) => (
            <div
              key={`${c.type}-${c.name}`}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft py-3 last:border-none"
            >
              <div>
                <div className="text-[13.5px] font-medium">
                  {c.name}{" "}
                  <span className="text-[11px] font-normal text-text-faint">
                    ({c.type === "INCOME" ? "income" : "expense"})
                  </span>
                </div>
                <div className="text-[12px] text-text-muted">
                  {formatEUR(c.amount)} · {RECURRING_FREQUENCY_LABELS[c.frequency]} · seen{" "}
                  {c.occurrences}&times;
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    dismissSuggestion.mutate({
                      name: c.name,
                      type: c.type,
                      amount: c.amount,
                      frequency: c.frequency,
                      categoryId: c.categoryId,
                      ownerId: c.ownerId,
                      lastDate: new Date(c.lastDate),
                    })
                  }
                  className="rounded-lg border border-border-soft px-3 py-1.5 text-[12.5px] font-medium text-text-muted hover:text-text"
                >
                  Not recurring
                </button>
                <button
                  onClick={() =>
                    confirmSuggestion.mutate({
                      name: c.name,
                      type: c.type,
                      amount: c.amount,
                      frequency: c.frequency,
                      categoryId: c.categoryId,
                      ownerId: c.ownerId,
                      lastDate: new Date(c.lastDate),
                    })
                  }
                  className="rounded-lg bg-accent-fill px-3 py-1.5 text-[12.5px] font-semibold text-accent-ink hover:opacity-90"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RecurringColumn
          type="INCOME"
          title="Income"
          total={monthlyIncome}
          totalClass="text-good"
          items={income}
          categories={categories ?? []}
          members={members}
          currentUserId={currentUserId}
          onAdd={(values) => createItem.mutate({ ...values, type: "INCOME" })}
          onUpdate={(id, values) => updateItem.mutate({ id, ...values })}
          onDelete={(id) => deleteItem.mutate({ id })}
          onToggleVisibility={(id, visible) => updateItem.mutate({ id, visibleToHousehold: visible })}
        />
        <RecurringColumn
          type="EXPENSE"
          title="Expenses"
          total={monthlyExpenses}
          totalClass="text-text"
          items={expenses}
          categories={categories ?? []}
          members={members}
          currentUserId={currentUserId}
          onAdd={(values) => createItem.mutate({ ...values, type: "EXPENSE" })}
          onUpdate={(id, values) => updateItem.mutate({ id, ...values })}
          onDelete={(id) => deleteItem.mutate({ id })}
          onToggleVisibility={(id, visible) => updateItem.mutate({ id, visibleToHousehold: visible })}
        />
      </div>
    </>
  );
}

function SummaryStrip({
  income,
  expenses,
  members,
  currentUserId,
}: {
  income: Item[];
  expenses: Item[];
  members: Member[];
  currentUserId: string;
}) {
  const relevantGroups = groupOrder(members, currentUserId).filter(
    (ownerId) =>
      ownerId === currentUserId ||
      ownerId === null ||
      income.some((i) => i.ownerId === ownerId) ||
      expenses.some((i) => i.ownerId === ownerId),
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {relevantGroups.map((ownerId) => {
        const groupIncome = income.filter((i) => i.ownerId === ownerId);
        const groupExpenses = expenses.filter((i) => i.ownerId === ownerId);
        const monthlyIncome = groupIncome.reduce((sum, i) => sum + monthlyEquivalent(i.amount, i.frequency), 0);
        const monthlyExpenses = groupExpenses.reduce((sum, i) => sum + monthlyEquivalent(i.amount, i.frequency), 0);
        return (
          <div key={ownerId ?? "shared"} className="rounded-[20px] border border-border-soft bg-surface p-5">
            <p className="mb-3 text-[11px] font-semibold tracking-[0.09em] text-text-faint uppercase">
              {groupLabel(ownerId, members, currentUserId)}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[10.5px] text-text-faint">Income</p>
                <p className="text-[16px] font-semibold text-good tabular-nums">{formatEUR(monthlyIncome)}</p>
              </div>
              <div>
                <p className="mb-1 text-[10.5px] text-text-faint">Expenses</p>
                <p className="text-[16px] font-semibold tabular-nums">{formatEUR(monthlyExpenses)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecurringColumn({
  type,
  title,
  total,
  totalClass,
  items,
  categories,
  members,
  currentUserId,
  onAdd,
  onUpdate,
  onDelete,
  onToggleVisibility,
}: {
  type: TxType;
  title: string;
  total: number;
  totalClass: string;
  items: Item[];
  categories: { id: string; name: string; color: string }[];
  members: Member[];
  currentUserId: string;
  onAdd: (values: FormValues) => void;
  onUpdate: (id: string, values: FormValues) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
}) {
  const [adding, setAdding] = useState(false);
  const multiMember = members.length > 1;

  const groups = multiMember
    ? groupOrder(members, currentUserId)
        .map((ownerId) => ({ ownerId, groupItems: items.filter((i) => i.ownerId === ownerId) }))
        .filter((g) => g.ownerId === currentUserId || g.ownerId === null || g.groupItems.length > 0)
    : [];

  return (
    <section className="overflow-hidden rounded-[20px] border border-border-soft bg-surface">
      <div className="px-6 pt-6 pb-4">
        <h2 className="mb-1 text-[15px] font-semibold">{title}</h2>
        <p className={`font-serif text-[22px] tabular-nums ${totalClass}`}>
          {formatEUR(total)} <span className="text-[13px] font-sans text-text-muted">/ month</span>
        </p>
      </div>

      {items.length === 0 && !adding && (
        <p className="border-b border-border-soft px-6 py-4 text-[13px] text-text-muted">
          Nothing here yet — add one below, or confirm a suggestion above once
          one turns up.
        </p>
      )}

      {multiMember
        ? groups.map(({ ownerId, groupItems }) => (
            <div key={ownerId ?? "shared"}>
              <div className="flex items-baseline justify-between px-6 pt-3 pb-1">
                <p className="text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
                  {groupLabel(ownerId, members, currentUserId)}
                </p>
                {groupItems.length > 0 && (
                  <p className="text-[11px] text-text-muted tabular-nums">
                    {formatEUR(groupItems.reduce((sum, i) => sum + monthlyEquivalent(i.amount, i.frequency), 0))} / mo
                  </p>
                )}
              </div>
              {groupItems.map((item) => (
                <RecurringRow
                  key={item.id}
                  item={item}
                  categories={categories}
                  members={members}
                  currentUserId={currentUserId}
                  onUpdate={(values) => onUpdate(item.id, values)}
                  onDelete={() => onDelete(item.id)}
                  onToggleVisibility={(visible) => onToggleVisibility(item.id, visible)}
                />
              ))}
            </div>
          ))
        : items.map((item) => (
            <RecurringRow
              key={item.id}
              item={item}
              categories={categories}
              members={members}
              currentUserId={currentUserId}
              onUpdate={(values) => onUpdate(item.id, values)}
              onDelete={() => onDelete(item.id)}
              onToggleVisibility={(visible) => onToggleVisibility(item.id, visible)}
            />
          ))}

      {adding ? (
        <InlineRecurringRow
          categories={categories}
          members={members}
          currentUserId={currentUserId}
          onSubmit={(values) => {
            onAdd(values);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center gap-3 border-b border-border-soft px-6 py-3 text-left text-text-faint transition-colors last:border-b-0 hover:text-text"
        >
          <span className="block h-2.5 w-2.5 shrink-0">
            <PlusIcon />
          </span>
          <span className="text-[13.5px]">Add {type === "INCOME" ? "income" : "expense"}</span>
        </button>
      )}
    </section>
  );
}

function RecurringRow({
  item,
  categories,
  members,
  currentUserId,
  onUpdate,
  onDelete,
  onToggleVisibility,
}: {
  item: Item;
  categories: { id: string; name: string; color: string }[];
  members: Member[];
  currentUserId: string;
  onUpdate: (values: FormValues) => void;
  onDelete: () => void;
  onToggleVisibility: (visible: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isOwn = item.ownerId === currentUserId;
  const canEdit = item.ownerId === null || isOwn;

  if (editing) {
    return (
      <InlineRecurringRow
        initial={item}
        categories={categories}
        members={members}
        currentUserId={currentUserId}
        onSubmit={(values) => {
          onUpdate(values);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-border-soft px-6 py-3 transition-colors last:border-b-0 hover:bg-surface-hover">
      <span
        className="block w-[3px] shrink-0 self-stretch rounded-full"
        style={{ background: item.category?.color ?? "#5c5f66" }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[13.5px] font-medium">
          {item.name}
        </div>
        <div className="mt-1 text-[12px] text-text-muted">
          {RECURRING_FREQUENCY_LABELS[item.frequency]}
          {item.nextDueDate && <> · next {formatDate(item.nextDueDate)}</>}
        </div>
      </div>
      <div className="text-[14px] font-semibold tabular-nums">{formatEUR(item.amount)}</div>
      {item.ownerId !== null &&
        (isOwn ? (
          <VisibilityToggle visible={item.visibleToHousehold} onChange={onToggleVisibility} />
        ) : (
          <VisibilityBadge />
        ))}
      {canEdit && (
        <>
          <button
            onClick={() => setEditing(true)}
            aria-label={`Edit ${item.name}`}
            className="h-4 w-4 shrink-0 text-text-muted hover:text-text"
          >
            <PencilIcon />
          </button>
          <button
            onClick={onDelete}
            aria-label={`Delete ${item.name}`}
            className="h-4 w-4 shrink-0 text-text-muted hover:text-critical"
          >
            <TrashIcon />
          </button>
        </>
      )}
    </div>
  );
}

/**
 * One row, editable in place — used both to create a new item (blank, prepended
 * to the list) and to edit an existing one (swapped in for its display row),
 * so adding/editing never leaves the list for a separate modal-like form.
 */
function InlineRecurringRow({
  initial,
  categories,
  members,
  currentUserId,
  onSubmit,
  onCancel,
}: {
  initial?: Item;
  categories: { id: string; name: string; color: string }[];
  members: Member[];
  currentUserId: string;
  onSubmit: (values: FormValues) => void;
  onCancel: () => void;
}) {
  const [frequency, setFrequency] = useState<RecurringFrequency>(initial?.frequency ?? "MONTHLY");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [ownerId, setOwnerId] = useState(initial ? (initial.ownerId ?? "") : currentUserId);
  const selectedColor = categories.find((c) => c.id === categoryId)?.color ?? "#5c5f66";
  const multiMember = members.length > 1;

  return (
    <form
      className="flex items-center gap-3 border-b border-border-soft bg-surface-2 px-6 py-2.5 last:border-b-0"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        onSubmit({
          name: String(form.get("name")),
          amount: Number(form.get("amount") || 0),
          frequency,
          categoryId: categoryId || null,
          // With no partner yet, default to personal (not shared) — same
          // privacy-conserving default used by the account owner picker.
          ownerId: multiMember ? ownerId || null : currentUserId,
        });
      }}
    >
      <span className="block w-[3px] shrink-0 self-stretch rounded-full" style={{ background: selectedColor }} />
      <div className="min-w-0 flex-1">
        <input
          name="name"
          required
          autoFocus
          defaultValue={initial?.name}
          placeholder="Name"
          className="w-full bg-transparent text-[13.5px] font-medium outline-none placeholder:text-text-faint"
        />
        <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[12px]">
          <InlineSelect
            value={frequency}
            onChange={(v) => setFrequency(v as RecurringFrequency)}
            options={FREQUENCIES.map((f) => ({ value: f, label: RECURRING_FREQUENCY_LABELS[f] }))}
          />
          <InlineSelect
            value={categoryId}
            onChange={setCategoryId}
            options={[
              { value: "", label: "No category" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          {multiMember && (
            <InlineSelect
              value={ownerId}
              onChange={setOwnerId}
              options={[
                { value: "", label: "Shared" },
                ...members.map((m) => ({
                  value: m.user.id,
                  label: m.user.id === currentUserId ? "You" : m.user.name || m.user.email,
                })),
              ]}
            />
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 text-[14px] font-semibold">
        <span className="text-text-faint">€</span>
        <input
          name="amount"
          type="number"
          step="0.01"
          required
          defaultValue={initial?.amount}
          placeholder="0.00"
          className="w-20 bg-transparent text-right tabular-nums outline-none placeholder:text-text-faint placeholder:font-normal"
        />
      </div>
      <button type="submit" aria-label="Save" className="h-4 w-4 shrink-0 text-good hover:opacity-80">
        <CheckIcon />
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel"
        className="h-4 w-4 shrink-0 text-text-muted hover:text-critical"
      >
        <CloseIcon />
      </button>
    </form>
  );
}

/**
 * A native <select> sized to fit its currently selected value, not (as
 * browsers do by default) to its widest option — otherwise picking "No
 * category" while a long category name exists leaves the chevron stranded
 * far past the visible text. The real select sits invisibly on top of a
 * label sized to just the current value; `peer-hover`/`peer-focus` on the
 * label let the chevron's color follow the select's hover/focus state even
 * though the label itself doesn't receive the pointer events.
 */
function InlineSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const currentLabel = options.find((o) => o.value === value)?.label ?? "";

  return (
    <span className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface text-text">
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none flex items-center gap-0.5 text-text-muted transition-colors peer-hover:text-text peer-focus:text-text">
        {currentLabel}
        <span className="block h-3 w-3">
          <ChevronDownIcon />
        </span>
      </span>
    </span>
  );
}

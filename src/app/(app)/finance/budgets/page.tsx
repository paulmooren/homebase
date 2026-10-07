"use client";

import { useMemo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { trpc } from "@/trpc/react";
import { formatEUR, formatSignedEUR, formatDate } from "@/lib/format";
import {
  HOUSEHOLD,
  YOU,
  entriesOf,
  monthlyOf,
  scopeOfOwner,
  soFarThisMonth,
  totalsOf,
  type AccountRef,
  type Entry,
  type ScopeKey,
} from "@/lib/budget-scope";
import { describeSchedule, todayInHousehold, SCHEDULE_UNITS, unitLabel, type ScheduleUnit } from "@/lib/schedule";
import { PencilIcon, TrashIcon, PlusIcon, CloseIcon, CheckIcon, ChevronDownIcon, ChartIcon, GripIcon } from "@/components/action-icons";
import { PaymentHistoryModal } from "@/components/finance/payment-history-modal";
import { SortableList } from "@/components/sortable-list";
import { applyReorder } from "@/lib/recurring-order";
import { Avatar } from "@/components/avatar";
import { groupOrder, groupLabel, type Member } from "@/components/finance/ownership-groups";
import { InlineEdit } from "@/components/inline-edit";
import { parseMoney } from "@/lib/money";
import { VisibilityToggle, VisibilityBadge } from "@/components/finance/visibility-toggle";

type TxType = "EXPENSE" | "INCOME" | "TRANSFER";

type Suggestion = {
  matchKey: string;
  name: string;
  type: TxType;
  amount: number;
  amountVaries: boolean;
  intervalCount: number;
  intervalUnit: "WEEK" | "MONTH";
  occurrences: number;
  lastDate: string | Date;
  confident: boolean;
  ownerId: string | null;
  accountId: string | null;
};

type Item = {
  id: string;
  name: string;
  type: TxType;
  amount: number;
  amountVaries: boolean;
  intervalCount: number;
  intervalUnit: ScheduleUnit;
  paymentCount: number;
  /** A different amount the payments suggest, waiting for the Member to approve it. */
  proposal: number | null;
  /** For a Fixed item: what its latest payment was, when that has drifted from the typed amount. */
  drift: number | null;
  source: "MANUAL" | "DETECTED";
  nextDueDate: string | Date | null;
  lastSeenAt: string | Date | null;
  categoryId: string | null;
  category: { color: string; name: string } | null;
  ownerId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  visibleToHousehold: boolean;
};

type FormValues = {
  name: string;
  amount: number;
  intervalCount: number;
  intervalUnit: ScheduleUnit;
  categoryId: string | null;
  ownerId: string | null;
  accountId: string | null;
};

type AccountOption = { id: string; name: string; institution: string | null; ownerId: string | null };

export default function BudgetsPage() {
  const { data: household } = trpc.household.current.useQuery();
  const { data: me } = trpc.user.me.useQuery();
  const { data: accounts } = trpc.account.list.useQuery();
  const { data: items } = trpc.recurring.list.useQuery();
  const members = useMemo<Member[]>(() => household?.members ?? [], [household]);
  const currentUserId = me?.id ?? "";

  const [scope, setScope] = useState<ScopeKey>(YOU);
  // Selecting an account narrows the lists to what runs through it; click it again to clear.
  const [accountFilter, setAccountFilter] = useState("");

  const accountRefs = useMemo(
    () => new Map<string, AccountRef>((accounts ?? []).map((a) => [a.id, { id: a.id, ownerId: a.ownerId }])),
    [accounts],
  );
  const entries = useMemo(
    () => ((items ?? []) as Item[]).flatMap((i) => entriesOf(i, accountRefs, currentUserId)),
    [items, accountRefs, currentUserId],
  );

  // The scopes you can look at: yours, the shared accounts, and any partner's accounts you may see.
  const scopes = useMemo(() => {
    const list: { key: ScopeKey; label: string }[] = [
      { key: YOU, label: "You" },
      { key: HOUSEHOLD, label: "Household" },
    ];
    for (const m of members) {
      if (m.user.id !== currentUserId) list.push({ key: m.user.id, label: m.user.name || m.user.email || "Partner" });
    }
    return list;
  }, [members, currentUserId]);
  const showScopes = members.length > 1;
  const activeScope = showScopes ? scope : YOU;

  const scopeEntries = entries.filter((e) => e.scope === activeScope);
  const scopeAccounts = (accounts ?? []).filter((a) => scopeOfOwner(a.ownerId, currentUserId) === activeScope);

  return (
    <div className="flex flex-col gap-5">
      <LeftEachMonth
        entries={scopeEntries}
        scopes={scopes}
        showScopes={showScopes}
        scope={activeScope}
        onScope={(key) => {
          setScope(key);
          setAccountFilter("");
        }}
        hasItems={(items ?? []).length > 0}
        changed={new Set(scopeEntries.filter((e) => (e.item as Item).proposal !== null).map((e) => e.item.id)).size}
      />
      <AccountCards
        accounts={scopeAccounts}
        entries={scopeEntries}
        selected={accountFilter}
        onSelect={setAccountFilter}
        members={members}
        currentUserId={currentUserId}
      />
      <RecurringItems
        members={members}
        currentUserId={currentUserId}
        accounts={accounts ?? []}
        accountFilter={accountFilter}
        scopeEntries={scopeEntries}
        scope={activeScope}
        accountRefs={accountRefs}
      />
    </div>
  );
}

/** The headline: what is left of the recurring income once every recurring cost is paid. */
function LeftEachMonth({
  entries,
  scopes,
  showScopes,
  scope,
  onScope,
  hasItems,
  changed,
}: {
  entries: Entry[];
  scopes: { key: ScopeKey; label: string }[];
  showScopes: boolean;
  scope: ScopeKey;
  onScope: (key: ScopeKey) => void;
  hasItems: boolean;
  /** How many items have a proposed new amount waiting. */
  changed: number;
}) {
  const { income, expenses, left } = totalsOf(entries);
  const sofar = soFarThisMonth(entries, todayInHousehold());
  const label = scopes.find((s) => s.key === scope)?.label ?? "You";

  return (
    <section className="rounded-[20px] border border-border-soft bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">Left each month</p>
        {showScopes && (
          <div role="tablist" aria-label="Whose budget" className="flex gap-1 rounded-xl bg-surface-2 p-1">
            {scopes.map((s) => (
              <button
                key={s.key}
                role="tab"
                aria-selected={scope === s.key}
                onClick={() => onScope(s.key)}
                className={`rounded-lg px-3 py-1 text-[12.5px] font-medium transition-colors ${
                  scope === s.key ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <p
        className={`font-display mt-2 text-[40px] leading-none font-bold tracking-tight tabular-nums ${
          left < 0 ? "text-critical" : "text-good"
        }`}
      >
        {hasItems ? formatSignedEUR(left).replace(/^\+/, "") : formatEUR(0)}
      </p>
      <p className="mt-2 text-[13.5px] text-text-muted">
        {hasItems
          ? `left each month after fixed costs — ${formatEUR(income)} comes in, ${formatEUR(expenses)} goes out (${label.toLowerCase() === "you" ? "your accounts" : label})`
          : "Add your recurring income and expenses below, or confirm the suggestions, to see what is left each month."}
      </p>
      {changed > 0 && (
        <button
          type="button"
          onClick={() => document.querySelector("[data-proposal]")?.scrollIntoView({ behavior: "smooth", block: "center" })}
          className="mt-3 rounded-lg bg-surface-2 px-3 py-1.5 text-[12.5px] font-medium text-text hover:bg-surface-hover"
        >
          {changed} amount{changed === 1 ? "" : "s"} changed — review
        </button>
      )}
      {hasItems && (
        <p className="mt-1 text-[12px] text-text-faint">
          So far this month: {formatEUR(sofar.income)} in, {formatEUR(sofar.expenses)} out · everyday spending such as
          groceries is not included
        </p>
      )}
    </section>
  );
}

/**
 * The monthly picture of each account in the chosen scope: its recurring
 * income and expenses, as monthly equivalents. Clicking a card narrows the
 * lists below to that account; click again to clear.
 */
function AccountCards({
  accounts,
  entries,
  selected,
  onSelect,
  members,
  currentUserId,
}: {
  accounts: AccountOption[];
  entries: Entry[];
  selected: string;
  onSelect: (id: string) => void;
  members: Member[];
  currentUserId: string;
}) {
  if (accounts.length === 0) return null;
  const multiMember = members.length > 1;

  return (
    <section>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => {
          const { income, expenses } = totalsOf(entries.filter((e) => e.accountId === a.id));
          const active = selected === a.id;
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? "" : a.id)}
              className={`rounded-[20px] border bg-surface p-5 text-left transition-colors hover:bg-surface-hover ${
                active ? "border-text" : "border-border-soft"
              }`}
            >
              <div className="mb-3 flex items-center gap-2.5">
                {multiMember && (
                  <Avatar
                    name={members.find((m) => m.user.id === a.ownerId)?.user.name || groupLabel(a.ownerId, members, currentUserId)}
                    image={members.find((m) => m.user.id === a.ownerId)?.user.image}
                    size={32}
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold">{a.name}</p>
                  <p className="truncate text-[11px] tracking-[0.04em] text-text-faint">
                    {[a.institution, multiMember ? groupLabel(a.ownerId, members, currentUserId) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-[10.5px] text-text-faint">Income / month</p>
                  <p className="text-[16px] font-semibold text-good tabular-nums">{formatEUR(income)}</p>
                </div>
                <div>
                  <p className="mb-1 text-[10.5px] text-text-faint">Expenses / month</p>
                  <p className="text-[16px] font-semibold tabular-nums">{formatEUR(expenses)}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * What the app found in your transactions, to review in one go: the
 * confident ones are ticked, one click adds them all.
 */
function SuggestionsPanel({ suggestions }: { suggestions: Suggestion[] }) {
  const utils = trpc.useUtils();
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const done = () => {
    utils.recurring.list.invalidate();
    utils.recurring.suggestions.invalidate();
    utils.transaction.list.invalidate();
  };
  const add = trpc.recurring.addSuggestions.useMutation({ onSuccess: done });
  const dismiss = trpc.recurring.dismissSuggestions.useMutation({ onSuccess: done });

  const isTicked = (c: Suggestion) => override[c.matchKey] ?? c.confident;
  const ticked = suggestions.filter(isTicked);
  const order: Record<TxType, number> = { INCOME: 0, TRANSFER: 1, EXPENSE: 2 };
  const sorted = [...suggestions].sort((a, b) => order[a.type] - order[b.type] || b.amount - a.amount);

  return (
    <section className="rounded-[20px] border border-border-soft bg-surface p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-[15px] font-semibold">
            {suggestions.length} recurring item{suggestions.length === 1 ? "" : "s"} found
          </h2>
          <p className="text-[13px] text-text-muted">
            Found in your transactions by who they were with, so a changing description doesn&apos;t matter. The
            confident ones are ticked — nothing is added until you say so.
          </p>
        </div>
        <button
          onClick={() => add.mutate({ matchKeys: ticked.map((c) => c.matchKey) })}
          disabled={ticked.length === 0 || add.isPending}
          className="rounded-xl bg-accent-fill px-4 py-2 text-[13px] font-semibold text-accent-ink hover:opacity-90 disabled:bg-surface-2 disabled:text-text-faint"
        >
          {add.isPending ? "Adding…" : `Add selected (${ticked.length})`}
        </button>
      </div>
      {sorted.map((c) => (
        <label
          key={c.matchKey}
          className="flex cursor-pointer flex-wrap items-center gap-3 border-b border-border-soft py-3 last:border-none"
        >
          <input
            type="checkbox"
            checked={isTicked(c)}
            onChange={(e) => setOverride((prev) => ({ ...prev, [c.matchKey]: e.target.checked }))}
            className="h-4 w-4 shrink-0 accent-[var(--accent-fill)]"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-medium">
              {c.name}{" "}
              <span className="text-[11px] font-normal text-text-faint">
                ({c.type === "INCOME" ? "income" : c.type === "TRANSFER" ? "transfer" : "expense"})
              </span>
            </div>
            <div className="text-[12px] text-text-muted">
              {c.amountVaries ? "about " : ""}
              {formatEUR(c.amount)}
              {c.amountVaries && " · varies"} · {describeSchedule(c.intervalCount, c.intervalUnit)} · seen {c.occurrences}
              &times;
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              dismiss.mutate({ matchKeys: [c.matchKey] });
            }}
            className="rounded-lg border border-border-soft px-3 py-1.5 text-[12.5px] font-medium text-text-muted hover:text-text"
          >
            Not recurring
          </button>
        </label>
      ))}
    </section>
  );
}

/** "You" first, then other household members in join order, "Shared" last. */
function RecurringItems({
  members,
  currentUserId,
  accounts,
  accountFilter,
  scopeEntries,
  scope,
  accountRefs,
}: {
  members: Member[];
  currentUserId: string;
  accounts: AccountOption[];
  accountFilter: string;
  scopeEntries: Entry<Item>[] | Entry[];
  scope: ScopeKey;
  accountRefs: Map<string, AccountRef>;
}) {
  const utils = trpc.useUtils();
  const { data: suggestions } = trpc.recurring.suggestions.useQuery();
  const { data: categories } = trpc.category.list.useQuery();

  const invalidate = () => {
    utils.recurring.list.invalidate();
    utils.recurring.suggestions.invalidate();
    utils.transaction.list.invalidate();
  };

  const createItem = trpc.recurring.create.useMutation({ onSuccess: invalidate });
  const updateItem = trpc.recurring.update.useMutation({ onSuccess: invalidate });
  const deleteItem = trpc.recurring.delete.useMutation({ onSuccess: invalidate });
  // A drop shows at once; the server confirms, or the list goes back to how it was.
  const reorder = trpc.recurring.reorder.useMutation({
    onMutate: async ({ ids }) => {
      await utils.recurring.list.cancel();
      const previous = utils.recurring.list.getData();
      utils.recurring.list.setData(undefined, (old) => (old ? applyReorder(old, ids) : old));
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) utils.recurring.list.setData(undefined, context.previous);
    },
    onSettled: () => utils.recurring.list.invalidate(),
  });

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "another account";

  const shown = (scopeEntries as Entry<Item>[]).filter((e) => !accountFilter || e.accountId === accountFilter);
  const income = shown.filter((e) => e.side === "INCOME");
  const expenses = shown.filter((e) => e.side === "EXPENSE");
  const monthlyIncome = income.reduce((sum, e) => sum + monthlyOf(e.item), 0);
  const monthlyExpenses = expenses.reduce((sum, e) => sum + monthlyOf(e.item), 0);

  const mine = (suggestions ?? []).filter(
    (c) => scopeOfOwner(c.ownerId, currentUserId) === scope && (!accountFilter || c.accountId === accountFilter),
  ) as Suggestion[];

  return (
    <>
      {mine.length > 0 && <SuggestionsPanel suggestions={mine} />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RecurringColumn
          type="INCOME"
          title="Income"
          total={monthlyIncome}
          totalClass="text-good"
          entries={income}
          categories={categories ?? []}
          members={members}
          currentUserId={currentUserId}
          accounts={accounts}
          accountFilter={accountFilter}
          accountName={accountName}
          accountRefs={accountRefs}
          onAdd={(values) => createItem.mutate({ ...values, type: "INCOME" })}
          onUpdate={(id, values) => updateItem.mutate({ id, ...values })}
          onDelete={(id) => deleteItem.mutate({ id })}
          onReorder={(ids) => reorder.mutate({ ids })}
          onToggleVisibility={(id, visible) => updateItem.mutate({ id, visibleToHousehold: visible })}
        />
        <RecurringColumn
          type="EXPENSE"
          title="Expenses"
          total={monthlyExpenses}
          totalClass="text-text"
          entries={expenses}
          categories={categories ?? []}
          members={members}
          currentUserId={currentUserId}
          accounts={accounts}
          accountFilter={accountFilter}
          accountName={accountName}
          accountRefs={accountRefs}
          onAdd={(values) => createItem.mutate({ ...values, type: "EXPENSE" })}
          onUpdate={(id, values) => updateItem.mutate({ id, ...values })}
          onDelete={(id) => deleteItem.mutate({ id })}
          onReorder={(ids) => reorder.mutate({ ids })}
          onToggleVisibility={(id, visible) => updateItem.mutate({ id, visibleToHousehold: visible })}
        />
      </div>
    </>
  );
}

function RecurringColumn({
  type,
  title,
  total,
  totalClass,
  entries,
  categories,
  members,
  currentUserId,
  accounts,
  accountFilter,
  accountName,
  accountRefs,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  onToggleVisibility,
}: {
  type: TxType;
  title: string;
  total: number;
  totalClass: string;
  entries: Entry<Item>[];
  categories: { id: string; name: string; color: string }[];
  members: Member[];
  currentUserId: string;
  accounts: AccountOption[];
  accountFilter: string;
  accountName: (id: string | null) => string;
  accountRefs: Map<string, AccountRef>;
  onAdd: (values: FormValues) => void;
  onUpdate: (id: string, values: Partial<FormValues>) => void;
  onDelete: (id: string) => void;
  /** The new order of these items, after one was dragged. */
  onReorder: (ids: string[]) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
}) {
  const [adding, setAdding] = useState(false);
  const multiMember = members.length > 1;

  const items = entries.map((e) => e.item);
  const groups = multiMember
    ? groupOrder(members, currentUserId)
        .map((ownerId) => ({
          ownerId,
          groupItems: entries.filter((e) => (accountRefs.get(e.accountId ?? "")?.ownerId ?? e.item.ownerId) === ownerId),
        }))
        .filter(
          (g) =>
            g.groupItems.length > 0 ||
            (!accountFilter && (g.ownerId === currentUserId || g.ownerId === null)),
        )
    : [];

  return (
    <section className="overflow-hidden rounded-[20px] border border-border-soft bg-surface">
      <div className="px-6 pt-6 pb-4">
        <h2 className="mb-1 text-[15px] font-semibold">{title}</h2>
        <p className={`font-display font-bold tracking-tight text-[22px] tabular-nums ${totalClass}`}>
          {formatEUR(total)} <span className="text-[13px] font-sans text-text-muted">/ month</span>
        </p>
      </div>

      {items.length === 0 && !adding && (
        <p className="border-b border-border-soft px-6 py-4 text-[13px] text-text-muted">
          Nothing here yet — add one below, or add a suggestion above once one
          turns up.
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
                    {formatEUR(groupItems.reduce((sum, e) => sum + monthlyOf(e.item), 0))} / mo
                  </p>
                )}
              </div>
              <SortableList ids={groupItems.map((e) => e.item.id)} onReorder={onReorder}>
                {groupItems.map((entry) => (
                  <RecurringRow
                    key={`${entry.item.id}-${entry.side}`}
                    item={entry.item}
                    side={entry.side}
                    accountName={accountName}
                    categories={categories}
                    members={members}
                    currentUserId={currentUserId}
                    accounts={accounts}
                    onUpdate={(values) => onUpdate(entry.item.id, values)}
                    onDelete={() => onDelete(entry.item.id)}
                    onToggleVisibility={(visible) => onToggleVisibility(entry.item.id, visible)}
                  />
              ))}
              </SortableList>
            </div>
          ))
        : (
            <SortableList ids={entries.map((e) => e.item.id)} onReorder={onReorder}>
              {entries.map((entry) => (
                <RecurringRow
                  key={`${entry.item.id}-${entry.side}`}
                  item={entry.item}
                  side={entry.side}
                  accountName={accountName}
                  categories={categories}
                  members={members}
                  currentUserId={currentUserId}
                  accounts={accounts}
                  onUpdate={(values) => onUpdate(entry.item.id, values)}
                  onDelete={() => onDelete(entry.item.id)}
                  onToggleVisibility={(visible) => onToggleVisibility(entry.item.id, visible)}
                />
              ))}
            </SortableList>
          )}

      {adding ? (
        <InlineRecurringRow
          categories={categories}
          members={members}
          currentUserId={currentUserId}
          accounts={accounts}
          defaultAccountId={accountFilter}
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
  side,
  accountName,
  categories,
  members,
  currentUserId,
  accounts,
  onUpdate,
  onDelete,
  onToggleVisibility,
}: {
  item: Item;
  /** Which side of the budget this row sits on; a transfer has one row on each. */
  side: "INCOME" | "EXPENSE";
  accountName: (id: string | null) => string;
  categories: { id: string; name: string; color: string }[];
  members: Member[];
  currentUserId: string;
  accounts: AccountOption[];
  onUpdate: (values: Partial<FormValues>) => void;
  onDelete: () => void;
  onToggleVisibility: (visible: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const utils = trpc.useUtils();
  const refresh = () => utils.recurring.list.invalidate();
  const acceptProposal = trpc.recurring.acceptProposal.useMutation({ onSuccess: refresh });
  const keepAmount = trpc.recurring.keepAmount.useMutation({ onSuccess: refresh });
  const isTransfer = item.type === "TRANSFER";
  // Due, but not in the transactions yet: say so quietly — it still counts.
  const notSeen = item.nextDueDate !== null && new Date(item.nextDueDate).getTime() < todayInHousehold().getTime();
  const isOwn = item.ownerId === currentUserId;
  const canEdit = item.ownerId === null || isOwn;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !canEdit || editing,
  });

  if (editing) {
    return (
      <InlineRecurringRow
        initial={item}
        categories={categories}
        members={members}
        currentUserId={currentUserId}
        accounts={accounts}
        onSubmit={(values) => {
          // Only a changed amount counts as typing one (which makes the item Fixed); a rename or new schedule must not.
          const { amount, ...rest } = values;
          onUpdate(amount === item.amount ? rest : values);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <>
    <div
      ref={setNodeRef}
      // Up and down only: the row follows the pointer vertically.
      style={{ transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null), transition }}
      className={`relative flex items-center gap-3 border-b border-border-soft px-6 py-3 transition-colors last:border-b-0 hover:bg-surface-hover ${
        isDragging ? "z-10 bg-surface shadow-lg" : ""
      }`}
    >
      {/* The grip: the only part that drags, so scrolling and clicking the name or amount work as usual. */}
      {canEdit ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${item.name}`}
          title="Drag to reorder"
          className="-ml-3 flex h-6 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-text-faint hover:text-text active:cursor-grabbing"
        >
          <GripIcon />
        </button>
      ) : (
        <span className="-ml-3 block w-5 shrink-0" aria-hidden />
      )}
      <span
        className="block w-[3px] shrink-0 self-stretch rounded-full"
        style={{ background: item.category?.color ?? "#5c5f66" }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[13.5px] font-medium">
          {canEdit ? (
            <InlineEdit
              value={item.name}
              ariaLabel="Name"
              onCommit={(name) => onUpdate({ name })}
              className="text-[13.5px] font-medium"
            />
          ) : (
            item.name
          )}
        </div>
        <div className="mt-1 text-[12px] text-text-muted">
          {isTransfer && (
            <>
              {side === "EXPENSE"
                ? `Transfer to ${accountName(item.toAccountId)}`
                : `Transfer from ${accountName(item.accountId)}`}{" "}
              ·{" "}
            </>
          )}
          {describeSchedule(item.intervalCount, item.intervalUnit)}
          {item.nextDueDate &&
            (notSeen ? (
              <span className="text-text-faint"> · expected {formatDate(item.nextDueDate)} — not seen yet</span>
            ) : (
              <> · next {formatDate(item.nextDueDate)}</>
            ))}
        </div>
        {item.proposal !== null && (
          <div data-proposal className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px]">
            <span className="font-medium text-text">
              New amount {formatEUR(item.proposal)}
              <span className="font-normal text-text-faint"> · was {formatEUR(item.amount)}</span>
            </span>
            {canEdit && (
              <>
                <button
                  type="button"
                  disabled={acceptProposal.isPending}
                  onClick={() => acceptProposal.mutate({ id: item.id })}
                  className="rounded-md bg-accent-fill px-2 py-0.5 font-semibold text-accent-ink hover:opacity-90"
                >
                  Update
                </button>
                <button
                  type="button"
                  disabled={keepAmount.isPending}
                  onClick={() => keepAmount.mutate({ id: item.id })}
                  className="rounded-md border border-border-soft px-2 py-0.5 font-medium text-text-muted hover:text-text"
                >
                  Keep
                </button>
              </>
            )}
          </div>
        )}
        {item.drift !== null && (
          <p className="mt-1 text-[12px] text-text-faint">Payments are now {formatEUR(item.drift)}</p>
        )}
      </div>
      {item.amountVaries && (
        <span
          title="The amount changes from payment to payment; this is the average of the last three"
          className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-text-muted"
        >
          varies
        </span>
      )}
      {canEdit ? (
        <InlineEdit
          value={String(item.amount)}
          editValue={formatEUR(item.amount)}
          display={formatEUR(item.amount)}
          ariaLabel="Amount"
          maxLength={14}
          onCommit={(text) => {
            // Accepts what was on screen ("€1,250.00") or a plain number ("1250,50").
            const parsed = parseMoney(text);
            if (parsed !== null && parsed > 0) onUpdate({ amount: parsed });
          }}
          className="text-right text-[14px] font-semibold tabular-nums"
          buttonClassName="block"
        />
      ) : (
        <div className="text-[14px] font-semibold tabular-nums">{formatEUR(item.amount)}</div>
      )}
      {item.ownerId !== null &&
        (isOwn ? (
          <VisibilityToggle visible={item.visibleToHousehold} onChange={onToggleVisibility} />
        ) : (
          <VisibilityBadge />
        ))}
      {item.paymentCount > 0 && (
        <button
          onClick={() => setShowHistory(true)}
          aria-label={`Payment history of ${item.name}`}
          title="Payment history"
          className="h-4 w-4 shrink-0 text-text-muted hover:text-text"
        >
          <ChartIcon />
        </button>
      )}
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
    {showHistory && <PaymentHistoryModal itemId={item.id} onClose={() => setShowHistory(false)} />}
    </>
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
  accounts,
  defaultAccountId,
  onSubmit,
  onCancel,
}: {
  initial?: Item;
  categories: { id: string; name: string; color: string }[];
  members: Member[];
  currentUserId: string;
  accounts: AccountOption[];
  defaultAccountId?: string;
  onSubmit: (values: FormValues) => void;
  onCancel: () => void;
}) {
  const [intervalCount, setIntervalCount] = useState(String(initial?.intervalCount ?? 1));
  const [intervalUnit, setIntervalUnit] = useState<ScheduleUnit>(initial?.intervalUnit ?? "MONTH");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  // Only accounts you can edit (yours or shared) can carry a recurring item.
  const writable = accounts.filter((a) => a.ownerId === null || a.ownerId === currentUserId);
  const [accountId, setAccountId] = useState(
    initial
      ? (initial.accountId ?? "")
      : writable.some((a) => a.id === defaultAccountId)
        ? (defaultAccountId as string)
        : (writable.find((a) => a.ownerId === currentUserId)?.id ?? writable[0]?.id ?? ""),
  );
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
          intervalCount: Math.max(1, Math.min(365, Math.round(Number(intervalCount) || 1))),
          intervalUnit,
          categoryId: categoryId || null,
          // With no partner yet, default to personal (not shared) — same
          // privacy-conserving default used by the account owner picker.
          ownerId: multiMember ? ownerId || null : currentUserId,
          accountId: accountId || null,
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
          <span className="inline-flex items-center gap-1 text-text-muted">
            Every
            <input
              type="number"
              min={1}
              max={365}
              value={intervalCount}
              onChange={(e) => setIntervalCount(e.target.value)}
              aria-label="Every how many"
              className="w-10 rounded-md border border-border-soft bg-surface px-1.5 py-0.5 text-center text-[12px] text-text tabular-nums outline-none focus:border-text-faint"
            />
            <InlineSelect
              value={intervalUnit}
              onChange={(v) => setIntervalUnit(v as ScheduleUnit)}
              options={SCHEDULE_UNITS.map((u) => ({ value: u, label: unitLabel(u, Number(intervalCount) || 1) }))}
            />
          </span>
          <InlineSelect
            value={categoryId}
            onChange={setCategoryId}
            options={[
              { value: "", label: "No category" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          {writable.length > 0 && (
            <InlineSelect
              value={accountId}
              onChange={setAccountId}
              options={[
                { value: "", label: "No account" },
                ...writable.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          )}
          {multiMember && !accountId && (
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

"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { trpc } from "@/trpc/react";
import { formatEUR, formatDate } from "@/lib/format";
import { TRANSFER_COLOR } from "@/lib/constants";
import {
  parseAmount,
  parseFlexibleDate,
  detectColumns,
  detectPartyColumns,
  cleanMerchant,
  normalizeIban,
} from "@/lib/csv";
import { describeImport, parseStatementText, statementIban, type ImportResult } from "@/lib/statement-import";
import { suggestCategoryId } from "@/lib/categorize";
import { Avatar } from "@/components/avatar";
import { PageActions } from "@/components/page-actions";
import { Modal, ModalFooter } from "@/components/modal";
import { Toast, toastPrimary, toastSecondary } from "@/components/toast";
import Link from "next/link";
import { RepeatIcon } from "@/components/action-icons";
import { MarkRecurringModal, type RecurringSource } from "@/components/finance/mark-recurring-modal";
import { RECURRING_FREQUENCY_LABELS } from "@/lib/constants";
import { Field, SelectInput, inputClass } from "@/components/settings/form";
import { CategoryCell } from "@/components/finance/category-cell";
import {
  NO_FILTERS,
  TransactionFilterBar,
  hasFilters,
  type TransactionFilters,
} from "@/components/finance/transaction-filters";
import { useCategoryAssign } from "@/components/finance/use-category-assign";
import { groupLabel, type Member } from "@/components/finance/ownership-groups";

type TxType = "EXPENSE" | "INCOME" | "TRANSFER";

const PAGE_SIZE = 200;

const COL_DATE = "w-[100px] shrink-0";
const COL_CATEGORY = "w-[160px] shrink-0";
const COL_AMOUNT = "w-[110px] shrink-0";

/** Shared text size for every transaction property, so merchant/date/category/amount all read at the same scale. */
const CELL_TEXT = "text-[14px]";
const COL_ACTIONS = "flex w-[56px] shrink-0 items-center justify-end gap-2.5";

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsPageInner />
    </Suspense>
  );
}

function TransactionsPageInner() {
  const searchParams = useSearchParams();
  const importAccountId = searchParams.get("import");

  const utils = trpc.useUtils();
  const { data: accounts } = trpc.account.list.useQuery();
  const { data: categories } = trpc.category.list.useQuery();
  // Deep-linkable (?account=<id>) so the Budgets tab's account cards can open
  // straight into one account's transactions.
  const [accountFilter, setAccountFilter] = useState(searchParams.get("account") ?? "");
  const [filters, setFilters] = useState<TransactionFilters>(NO_FILTERS);
  const filtering = hasFilters(filters);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const { data: recurring } = trpc.recurring.list.useQuery();
  const [recurringFor, setRecurringFor] = useState<RecurringSource | null>(null);
  const [recurringAdded, setRecurringAdded] = useState<{ name: string; type: "EXPENSE" | "INCOME" } | null>(null);

  // A transaction counts as recurring when an active recurring item carries its
  // merchant text (as its name or the text it was detected from) on the same
  // account, or on no particular account.
  const recurringByMerchant = new Map<string, NonNullable<typeof recurring>[number]>();
  for (const item of recurring ?? []) {
    for (const text of [item.name, item.detectedName]) {
      if (text) recurringByMerchant.set(`${normalizeText(text)}|${item.accountId ?? ""}`, item);
    }
  }
  const recurringFor_ = (merchant: string, accountId: string) =>
    recurringByMerchant.get(`${normalizeText(merchant)}|${accountId}`) ??
    recurringByMerchant.get(`${normalizeText(merchant)}|`);
  const { data: transactions } = trpc.transaction.list.useQuery(
    {
      limit,
      ...(accountFilter ? { accountId: accountFilter } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
      ...(filters.categoryIds.length ? { categoryIds: filters.categoryIds } : {}),
      ...(filters.minAmount !== undefined ? { minAmount: filters.minAmount } : {}),
      ...(filters.maxAmount !== undefined ? { maxAmount: filters.maxAmount } : {}),
    },
    // Keep the old rows on screen while a new filter loads, so the list doesn't flash empty.
    { placeholderData: (previous) => previous },
  );
  const { data: household } = trpc.household.current.useQuery();
  const { data: me } = trpc.user.me.useQuery();

  const members: Member[] = household?.members ?? [];
  const currentUserId = me?.id ?? "";
  const multiMember = members.length > 1;
  // Visible-but-not-yours accounts are read-only, so they're not offered when
  // adding or importing transactions.
  const writableAccounts = (accounts ?? []).filter(
    (a) => a.ownerId === null || a.ownerId === currentUserId,
  );

  // "Remove all" only ever touches transactions on accounts you can edit — for
  // a filtered account that's its own transactions (not incoming transfers).
  const filteredAccount = accounts?.find((a) => a.id === accountFilter);
  const removableCount = (transactions ?? []).filter((t) =>
    accountFilter
      ? t.accountId === accountFilter && (t.account.ownerId === null || t.account.ownerId === currentUserId)
      : t.account.ownerId === null || t.account.ownerId === currentUserId,
  ).length;

  const [mode, setMode] = useState<"none" | "manual" | "import">(
    importAccountId ? "import" : "none",
  );

  const createTransaction = trpc.transaction.create.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.dashboard.summary.invalidate();
      utils.dashboard.netWorthHistory.invalidate();
      utils.budget.list.invalidate();
      setMode("none");
    },
  });
  const deleteTransaction = trpc.transaction.delete.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.dashboard.summary.invalidate();
      utils.dashboard.netWorthHistory.invalidate();
      utils.budget.list.invalidate();
    },
  });
  const { assign: assignCategory, toast: categoryToast } = useCategoryAssign(categories ?? []);
  const removeAllTransactions = trpc.transaction.removeAll.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.dashboard.summary.invalidate();
      utils.dashboard.netWorthHistory.invalidate();
      utils.budget.list.invalidate();
    },
  });

  return (
    <div className="flex flex-col gap-5">
      {categoryToast}
      <PageActions>
        {removableCount > 0 && !filtering && (
          <button
            onClick={() => {
              const scope = filteredAccount ? `on ${filteredAccount.name}` : "on your accounts";
              if (
                confirm(
                  `Delete all transactions ${scope}? This cannot be undone and will reset the affected account balances.`,
                )
              ) {
                removeAllTransactions.mutate(accountFilter ? { accountId: accountFilter } : undefined);
              }
            }}
            disabled={removeAllTransactions.isPending}
            className="px-2 text-[13px] font-medium text-critical hover:opacity-80 disabled:opacity-60"
          >
            Remove all
          </button>
        )}
        <button
          onClick={() => setMode("import")}
          className="rounded-xl border border-border bg-surface px-4 py-2.5 text-[13.5px] font-medium hover:bg-surface-hover"
        >
          Import CSV
        </button>
        <button
          onClick={() => setMode("manual")}
          className="rounded-xl bg-accent-fill px-4 py-2.5 text-[13.5px] font-semibold text-accent-ink hover:opacity-90"
        >
          + Transaction
        </button>
      </PageActions>

      <section>
        {/* Accounts on the left, what to look for on the right. */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          {accounts && accounts.length > 1 && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by account">
              <FilterChip active={!accountFilter} onClick={() => setAccountFilter("")}>
                All
              </FilterChip>
              {accounts.map((a) => {
                const active = accountFilter === a.id;
                return (
                  <FilterChip
                    key={a.id}
                    active={active}
                    onClick={() => setAccountFilter(active ? "" : a.id)}
                    title={`${a.name} · ${groupLabel(a.ownerId, members, currentUserId)}`}
                  >
                    {multiMember && (
                      <Avatar
                        name={ownerName(a.ownerId, members, currentUserId)}
                        image={members.find((m) => m.user.id === a.ownerId)?.user.image}
                      />
                    )}
                    {a.name}
                    {multiMember && (
                      <span className={active ? "text-bg/70" : "text-text-faint"}>
                        · {groupLabel(a.ownerId, members, currentUserId)}
                      </span>
                    )}
                  </FilterChip>
                );
              })}
            </div>
          )}
          <TransactionFilterBar
            filters={filters}
            onChange={(next) => {
              setFilters(next);
              setLimit(PAGE_SIZE);
            }}
            categories={categories ?? []}
          />
        </div>

        {filtering && transactions && (
          <FilterSummary transactions={transactions} limit={limit} />
        )}

        {mode === "manual" && writableAccounts.length > 0 && (
          <Modal title="New transaction" onClose={() => setMode("none")}>
            <ManualTransactionForm
              accounts={writableAccounts}
              initialAccountId={accountFilter || undefined}
              categories={categories ?? []}
              pending={createTransaction.isPending}
              onSubmit={(values) => createTransaction.mutate(values)}
              onCancel={() => setMode("none")}
            />
          </Modal>
        )}

        {mode === "import" && writableAccounts.length > 0 && (
          <Modal title="Import bank statement" onClose={() => setMode("none")} width="max-w-3xl">
            <CsvImportForm
              accounts={writableAccounts}
              categories={categories ?? []}
              initialAccountId={accountFilter || importAccountId || undefined}
              onImported={(result) => {
                setImported(result);
                setMode("none");
              }}
              onCancel={() => setMode("none")}
            />
          </Modal>
        )}

        {recurringFor && (
          <MarkRecurringModal
            source={recurringFor}
            categories={categories ?? []}
            onClose={() => setRecurringFor(null)}
            onDone={(result) => {
              setRecurringFor(null);
              setRecurringAdded(result);
            }}
          />
        )}

        {recurringAdded && (
          <Toast
            onClose={() => setRecurringAdded(null)}
            actions={
              <>
                <Link href="/finance/budgets" onClick={() => setRecurringAdded(null)} className={toastPrimary}>
                  View in Budgets
                </Link>
                <button type="button" onClick={() => setRecurringAdded(null)} className={toastSecondary}>
                  Close
                </button>
              </>
            }
          >
            <p className="font-semibold">
              ✓ Added to recurring {recurringAdded.type === "INCOME" ? "income" : "expenses"}
            </p>
            <p className="mt-0.5 text-bg/75">{recurringAdded.name}</p>
          </Toast>
        )}

        {imported !== null && (
          <Toast
            onClose={() => setImported(null)}
            actions={
              <button type="button" onClick={() => setImported(null)} className={toastPrimary}>
                Done
              </button>
            }
          >
            <p className="font-semibold">✓ {describeImport(imported).headline}</p>
            {describeImport(imported).detail && (
              <p className="mt-0.5 text-bg/75">{describeImport(imported).detail}</p>
            )}
          </Toast>
        )}

        <div className="-mx-4 mt-5 overflow-x-auto border-t border-border-soft md:-mx-6">
          <div className="min-w-[640px]">
            <div className="flex items-center gap-3.5 px-6 pt-5 pb-2.5 text-[10.5px] font-semibold tracking-[0.08em] text-text-faint uppercase">
              <span className="block w-[3px] shrink-0" />
              <div className="min-w-0 flex-1" />
              <div className={COL_DATE}>Date</div>
              <div className={COL_CATEGORY}>Category</div>
              <div className={COL_AMOUNT}>Amount</div>
              <div className={COL_ACTIONS} />
            </div>

            {transactions?.length === 0 && (
              <p className="px-6 py-4 text-[13px] text-text-muted">
                {filtering ? "No transactions match these filters." : "No transactions yet."}
              </p>
            )}

            {transactions?.map((t) => {
              const isTransfer = t.type === "TRANSFER";
              const isIncome = t.type === "INCOME";
              // Seen through one account, a transfer into it is money in.
              const isInflow =
                isIncome || (isTransfer && !!accountFilter && t.transferToAccountId === accountFilter);
              const label =
                isTransfer && accountFilter
                  ? t.transferToAccountId === accountFilter
                    ? `Transfer from ${t.account.name}`
                    : `Transfer to ${t.transferToAccount?.name ?? "another account"}`
                  : t.merchant;
              const barColor = isTransfer ? TRANSFER_COLOR : (t.category?.color ?? "#c7c9cf");
              const canEdit = t.account.ownerId === null || t.account.ownerId === currentUserId;
              const recurringItem = isTransfer ? undefined : recurringFor_(t.merchant, t.accountId);
              return (
                <div
                  key={t.id}
                  className="group flex items-center gap-3.5 border-b border-border-soft px-6 py-3 transition-colors last:border-b-0 hover:bg-surface-hover"
                >
                  <span
                    className="block w-[3px] shrink-0 self-stretch rounded-full"
                    style={{ background: barColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate ${CELL_TEXT} font-medium`}>{label}</div>
                    {multiMember && (
                      <div className="flex items-center gap-1.5 truncate text-[11px] text-text-faint">
                        {multiMember && (
                          <span className="truncate">
                            {t.account.name} · {groupLabel(t.account.ownerId, members, currentUserId)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={`${COL_DATE} truncate ${CELL_TEXT} text-text-muted`}>
                    {formatDate(t.date)}
                  </div>
                  <div className={COL_CATEGORY}>
                    {isTransfer ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border border-border-soft bg-surface-2 px-2.5 py-0.5 ${CELL_TEXT} text-text-muted`}
                      >
                        ↔ Transfer
                      </span>
                    ) : canEdit ? (
                      <CategoryCell
                        categoryId={t.categoryId}
                        categories={categories ?? []}
                        onChange={(categoryId) => assignCategory(t.id, categoryId)}
                      />
                    ) : (
                      <span className={`truncate ${CELL_TEXT} text-text-muted`}>
                        {t.category?.name ?? "No category"}
                      </span>
                    )}
                  </div>
                  <div
                    className={`${COL_AMOUNT} truncate ${CELL_TEXT} font-semibold tabular-nums ${
                      isIncome ? "text-good" : isTransfer ? "text-text-muted" : ""
                    }`}
                  >
                    {isInflow ? "+" : "−"} {formatEUR(Number(t.amount))}
                  </div>
                  <div className={COL_ACTIONS}>
                    {!isTransfer && recurringItem && (
                      // Active: this transaction belongs to a recurring item. Hovering says how often.
                      <span className="group/rec relative flex h-6 w-6 items-center justify-center text-good">
                        <span className="block h-3.5 w-3.5">
                          <RepeatIcon />
                        </span>
                        <span className="pointer-events-none absolute right-0 bottom-full z-20 mb-1.5 hidden whitespace-nowrap rounded-lg bg-text px-2.5 py-1.5 text-[11.5px] font-medium text-bg shadow-lg group-hover/rec:block">
                          Recurring · {RECURRING_FREQUENCY_LABELS[recurringItem.frequency]}
                        </span>
                      </span>
                    )}
                    {canEdit && !isTransfer && !recurringItem && (
                      <button
                        type="button"
                        onClick={() =>
                          setRecurringFor({
                            id: t.id,
                            merchant: t.merchant,
                            type: t.type as "EXPENSE" | "INCOME",
                            amount: Number(t.amount),
                            date: t.date,
                            categoryId: t.categoryId,
                            accountId: t.accountId,
                            accountName: t.account.name,
                          })
                        }
                        aria-label={`Mark ${t.merchant} as recurring`}
                        title={isIncome ? "Mark as recurring income" : "Mark as recurring expense"}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-surface-2 hover:text-text"
                      >
                        <span className="block h-3.5 w-3.5">
                          <RepeatIcon />
                        </span>
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => {
                          if (confirm("Delete this transaction?")) deleteTransaction.mutate({ id: t.id });
                        }}
                        className="text-[12px] text-text-muted hover:text-critical"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {transactions && transactions.length >= limit && (
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE_SIZE)}
                className="block w-full px-6 py-3.5 text-left text-[13px] font-medium text-accent hover:opacity-80"
              >
                Showing the latest {transactions.length} — load more
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/** What the current filters add up to — only exact once every match is loaded. */
function FilterSummary({
  transactions,
  limit,
}: {
  transactions: { type: string; amount: unknown }[];
  limit: number;
}) {
  const truncated = transactions.length >= limit;
  let expenses = 0;
  let income = 0;
  for (const t of transactions) {
    if (t.type === "EXPENSE") expenses += Number(t.amount);
    else if (t.type === "INCOME") income += Number(t.amount);
  }
  return (
    <p className="mt-3 text-[12.5px] text-text-muted md:text-right">
      {truncated ? `${transactions.length}+` : transactions.length} transaction{transactions.length === 1 ? "" : "s"}
      {truncated
        ? " — load more for exact totals"
        : ` · ${formatEUR(expenses)} spent · ${formatEUR(income)} received`}
    </p>
  );
}

function ownerName(ownerId: string | null, members: Member[], currentUserId: string) {
  if (ownerId === null) return "Shared";
  const member = members.find((m) => m.user.id === ownerId);
  return member?.user.name || member?.user.email || (ownerId === currentUserId ? "You" : "?");
}

/** Quick-filter pill: filled when active, click again to clear. */
function FilterChip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors ${
        active
          ? "border-text bg-text text-bg"
          : "border-transparent bg-surface-2 text-text-muted hover:bg-border-soft hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function ManualTransactionForm({
  accounts,
  initialAccountId,
  categories,
  pending,
  onSubmit,
  onCancel,
}: {
  accounts: { id: string; name: string }[];
  initialAccountId?: string;
  categories: { id: string; name: string }[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: {
    accountId: string;
    type: TxType;
    amount: number;
    date: Date;
    merchant: string;
    categoryId?: string;
    transferToAccountId?: string;
  }) => void;
}) {
  const [type, setType] = useState<TxType>("EXPENSE");
  const [accountId, setAccountId] = useState(
    initialAccountId && accounts.some((a) => a.id === initialAccountId) ? initialAccountId : (accounts[0]?.id ?? ""),
  );

  return (
    <form
      className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        onSubmit({
          accountId,
          type,
          amount: Math.abs(Number(form.get("amount") || 0)),
          date: new Date(String(form.get("date"))),
          merchant: String(form.get("merchant")),
          categoryId: type === "TRANSFER" ? undefined : String(form.get("categoryId") || "") || undefined,
          transferToAccountId:
            type === "TRANSFER" ? String(form.get("transferToAccountId") || "") || undefined : undefined,
        });
      }}
    >
      <Field label="Account">
        <SelectInput value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Type">
        <SelectInput value={type} onChange={(e) => setType(e.target.value as TxType)}>
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
          <option value="TRANSFER">Transfer</option>
        </SelectInput>
      </Field>
      <Field label="Description">
        <input name="merchant" required autoFocus placeholder="e.g. Albert Heijn" className={inputClass} />
      </Field>
      <Field label="Amount (€)">
        <input name="amount" type="number" step="0.01" required placeholder="0.00" className={inputClass} />
      </Field>
      {type === "TRANSFER" ? (
        <Field label="To account">
          <SelectInput name="transferToAccountId" required defaultValue="">
            <option value="">Choose destination account</option>
            {accounts
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </SelectInput>
        </Field>
      ) : (
        <Field label="Category (optional)">
          <SelectInput name="categoryId" defaultValue="">
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}
      <Field label="Date">
        <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
      </Field>
      <ModalFooter className="col-span-full">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent-fill px-5 py-2.5 text-[13.5px] font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
        >
          Add transaction
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-border px-5 py-2.5 text-[13.5px] font-medium text-text-muted hover:bg-surface-hover hover:text-text"
        >
          Cancel
        </button>
      </ModalFooter>
    </form>
  );
}

type ParsedRow = Record<string, string>;

function CsvImportForm({
  accounts,
  categories,
  initialAccountId,
  onImported,
  onCancel,
}: {
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; color: string }[];
  initialAccountId?: string;
  onImported: (result: ImportResult) => void;
  onCancel: () => void;
}) {
  const utils = trpc.useUtils();
  const [accountId, setAccountId] = useState(
    initialAccountId && accounts.some((a) => a.id === initialAccountId)
      ? initialAccountId
      : (accounts[0]?.id ?? ""),
  );
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [dateCol, setDateCol] = useState("");
  const [merchantCol, setMerchantCol] = useState("");
  const [merchantFallbackCol, setMerchantFallbackCol] = useState("");
  const [amountCol, setAmountCol] = useState("");
  // Who the statement is for and who each row was with; empty when the bank doesn't export them.
  const [partyCols, setPartyCols] = useState({ accountIbanCol: "", counterpartyIbanCol: "", counterpartyNameCol: "" });
  const [categoryOverrides, setCategoryOverrides] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);

  const importCsv = trpc.transaction.importCsv.useMutation({
    onSuccess: (result) => {
      utils.transaction.list.invalidate();
      utils.dashboard.summary.invalidate();
      utils.dashboard.netWorthHistory.invalidate();
      utils.account.list.invalidate();
      utils.dashboard.missingStatements.invalidate();
      onImported(result);
    },
  });

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    const parsed = parseStatementText(await file.text());
    if (!parsed) {
      setError("Couldn't read the file. Is it a valid CSV file?");
      return;
    }
    setHeaders(parsed.fields);
    setRows(parsed.rows);
    const cols = detectColumns(parsed.fields);
    setDateCol(cols.dateCol);
    setMerchantCol(cols.merchantCol);
    setMerchantFallbackCol(cols.merchantFallbackCol);
    setAmountCol(cols.amountCol);
    setPartyCols(detectPartyColumns(parsed.fields));
  }

  const parsedRows = useMemo(
    () =>
      rows.map((row) => {
        const primary = merchantCol ? cleanMerchant(row[merchantCol] ?? "") : "";
        const fallback = merchantFallbackCol ? cleanMerchant(row[merchantFallbackCol] ?? "") : "";
        return {
          date: dateCol ? parseFlexibleDate(row[dateCol] ?? "") : null,
          merchant: primary || fallback || "Transaction",
          amount: amountCol ? parseAmount(row[amountCol] ?? "") : NaN,
          counterpartyIban: partyCols.counterpartyIbanCol ? normalizeIban(row[partyCols.counterpartyIbanCol]) : null,
          counterpartyName: partyCols.counterpartyNameCol
            ? cleanMerchant(row[partyCols.counterpartyNameCol] ?? "") || null
            : null,
        };
      }),
    [rows, dateCol, merchantCol, merchantFallbackCol, amountCol, partyCols],
  );

  function categoryFor(i: number, merchant: string) {
    return categoryOverrides[i] ?? suggestCategoryId(merchant, categories) ?? "";
  }

  const categorizedCount = parsedRows.filter((p, i) => categoryFor(i, p.merchant)).length;
  const skippedCount = parsedRows.filter((r) => !r.date || Number.isNaN(r.amount)).length;

  function handleImport() {
    const parsed = parsedRows
      .map((row, i) => ({ ...row, categoryId: categoryFor(i, row.merchant) || undefined }))
      .filter((r) => r.date && r.merchant && !Number.isNaN(r.amount)) as {
      date: Date;
      merchant: string;
      amount: number;
      categoryId?: string;
      counterpartyIban: string | null;
      counterpartyName: string | null;
    }[];

    if (parsed.length === 0) {
      setError("No valid rows found. Check the column mapping.");
      return;
    }
    importCsv.mutate({
      accountId,
      accountIban: statementIban(rows, partyCols.accountIbanCol),
      rows: parsed,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="Account">
        <SelectInput value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectInput>
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-[12.5px] text-text-muted">Bank statement</span>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            dragging ? "border-text bg-surface-2" : "border-border hover:border-text-faint hover:bg-surface-hover"
          }`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-text-muted">
            {fileName ? <FileIcon /> : <UploadIcon />}
          </span>
          {fileName ? (
            <>
              <span className="max-w-full truncate text-[14px] font-medium">{fileName}</span>
              <span className="text-[12.5px] text-text-muted">Drop or click to choose a different file</span>
            </>
          ) : (
            <>
              <span className="text-[14px] font-medium">
                Drag and drop your statement here, or <span className="underline">browse</span>
              </span>
              <span className="text-[12.5px] text-text-muted">CSV file from your bank</span>
            </>
          )}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      </div>

      {(error || importCsv.error) && (
        <p className="rounded-xl border border-critical/30 bg-critical/10 px-3.5 py-2.5 text-[13px] text-critical">
          {error ??
            (importCsv.error?.data?.code === "BAD_REQUEST"
              ? importCsv.error.message
              : "The import didn't go through. Please try again, or check the column mapping.")}
        </p>
      )}

      {headers.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-3">
            <ColumnSelect label="Date column" headers={headers} value={dateCol} onChange={setDateCol} />
            <ColumnSelect
              label="Description column"
              headers={headers}
              value={merchantCol}
              onChange={setMerchantCol}
            />
            <ColumnSelect label="Amount column" headers={headers} value={amountCol} onChange={setAmountCol} />
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-soft">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-surface-2 text-text-faint">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((p, i) => {
                  const categoryId = categoryFor(i, p.merchant);
                  const color = categories.find((c) => c.id === categoryId)?.color ?? "#9a9da5";
                  return (
                    <tr key={i} className="border-t border-border-soft">
                      <td className="px-3 py-2 whitespace-nowrap text-text-muted">
                        {p.date ? formatDate(p.date) : "—"}
                      </td>
                      <td className="px-3 py-2">{p.merchant}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                          <select
                            value={categoryId}
                            onChange={(e) => setCategoryOverrides((prev) => ({ ...prev, [i]: e.target.value }))}
                            className="w-full min-w-[120px] rounded-md border border-border bg-surface px-2 py-1 text-[12px] text-text outline-none focus:border-accent"
                          >
                            <option value="">No category</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Number.isNaN(p.amount) ? "—" : formatEUR(p.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="-mt-1 flex flex-col gap-1.5">
            <p className="text-[12px] text-text-muted">
              {rows.length} rows detected · {categorizedCount} categorized automatically — review before
              importing · negative amount = expense, positive amount = income
            </p>
            {skippedCount > 0 && (
              <p className="text-[12px] font-medium text-critical">
                {skippedCount} row{skippedCount === 1 ? "" : "s"} will be skipped — unreadable date or amount. Check
                the column mapping above.
              </p>
            )}
          </div>
        </>
      )}

      <ModalFooter>
        <button
          onClick={handleImport}
          disabled={importCsv.isPending || headers.length === 0}
          className="rounded-xl bg-accent-fill px-5 py-2.5 text-[13.5px] font-semibold text-accent-ink hover:opacity-90 disabled:bg-surface-2 disabled:text-text-faint"
        >
          {importCsv.isPending ? "Importing…" : headers.length > 0 ? `Import ${rows.length} transactions` : "Import"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-border px-5 py-2.5 text-[13.5px] font-medium text-text-muted hover:bg-surface-hover hover:text-text"
        >
          Cancel
        </button>
      </ModalFooter>
    </div>
  );
}

function ColumnSelect({
  label,
  headers,
  value,
  onChange,
}: {
  label: string;
  headers: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <SelectInput value={value} onChange={(e) => onChange(e.target.value)}>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </SelectInput>
    </Field>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

function normalizeText(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

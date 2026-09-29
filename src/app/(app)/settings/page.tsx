"use client";

import { useState } from "react";
import Link from "next/link";

import { trpc } from "@/trpc/react";
import { signOutAction } from "./actions";
import { ACCOUNT_TYPE_LABELS, ASSET_ACCOUNT_TYPES, type AccountType } from "@/lib/constants";
import { formatEUR } from "@/lib/format";
import { AccountTypeIcon } from "@/components/account-type-icon";

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

const STATUS_LABEL: Record<string, string> = {
  good: "On track",
  warn: "Near limit",
  critical: "over budget",
};
const STATUS_CLASS: Record<string, string> = {
  good: "text-good",
  warn: "text-warn",
  critical: "text-critical",
};
const BAR_CLASS: Record<string, string> = {
  good: "bg-good",
  warn: "bg-warn",
  critical: "bg-critical",
};

type Account = {
  id: string;
  name: string;
  institution: string | null;
  type: string;
  startingBalance: unknown;
  balance: unknown;
  ownerId: string | null;
};

type Member = { user: { id: string; name: string | null; email: string } };

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.user.me.useQuery();
  const { data: categories } = trpc.category.list.useQuery();
  const { data: household } = trpc.household.current.useQuery();
  const { data: accounts } = trpc.account.list.useQuery();
  const { data: budgets } = trpc.budget.list.useQuery();

  const updateName = trpc.user.updateName.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  });
  const createCategory = trpc.category.create.useMutation({
    onSuccess: () => utils.category.list.invalidate(),
  });
  const updateCategory = trpc.category.update.useMutation({
    onSuccess: () => utils.category.list.invalidate(),
  });
  const deleteCategory = trpc.category.delete.useMutation({
    onSuccess: () => utils.category.list.invalidate(),
  });
  const renameHousehold = trpc.household.rename.useMutation({
    onSuccess: () => utils.household.current.invalidate(),
  });
  const regenerateInvite = trpc.household.regenerateInvite.useMutation({
    onSuccess: () => utils.household.current.invalidate(),
  });
  const updateSharing = trpc.user.updateSharing.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  });
  const createAccount = trpc.account.create.useMutation({
    onSuccess: () => {
      utils.account.list.invalidate();
      utils.dashboard.summary.invalidate();
      setShowAccountForm(false);
    },
  });
  const updateAccount = trpc.account.update.useMutation({
    onSuccess: () => {
      utils.account.list.invalidate();
      utils.dashboard.summary.invalidate();
      setEditingAccount(null);
    },
  });
  const deleteAccount = trpc.account.delete.useMutation({
    onSuccess: () => {
      utils.account.list.invalidate();
      utils.dashboard.summary.invalidate();
    },
  });
  const upsertBudget = trpc.budget.upsert.useMutation({
    onSuccess: () => utils.budget.list.invalidate(),
  });
  const deleteBudget = trpc.budget.delete.useMutation({
    onSuccess: () => utils.budget.list.invalidate(),
  });

  const [newCategory, setNewCategory] = useState("");
  const [newColor, setNewColor] = useState("#7fb8e8");
  const [copied, setCopied] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const members: Member[] = household?.members ?? [];
  const currentUserId = me?.id ?? "";

  const assets = accounts?.filter((a) => (ASSET_ACCOUNT_TYPES as readonly string[]).includes(a.type));
  const liabilities = accounts?.filter((a) => !(ASSET_ACCOUNT_TYPES as readonly string[]).includes(a.type));

  const budgeted = new Set(budgets?.map((b) => b.categoryId));
  const unbudgeted = categories?.filter((c) => !budgeted.has(c.id));
  const monthLabel = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  function inviteUrl(code: string) {
    return `${window.location.origin}/household-setup?join=${code}`;
  }

  async function copyInviteLink() {
    if (!household?.inviteCode) return;
    await navigator.clipboard.writeText(inviteUrl(household.inviteCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function exportJson() {
    const data = await utils.user.exportData.fetch();
    downloadBlob(JSON.stringify(data, null, 2), "kontor-export.json", "application/json");
  }

  async function exportCsv() {
    const transactions = await utils.transaction.list.fetch({ limit: 200 });
    const header = "Date,Description,Category,Type,Amount\n";
    const body = transactions
      .map((t) =>
        [
          new Date(t.date).toISOString().slice(0, 10),
          `"${t.merchant.replace(/"/g, '""')}"`,
          t.category?.name ?? "",
          t.type,
          Number(t.amount).toFixed(2),
        ].join(","),
      )
      .join("\n");
    downloadBlob(header + body, "kontor-transactions.csv", "text/csv");
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[20px] border border-border-soft bg-surface p-6">
        <h1 className="mb-4 text-[15px] font-semibold">Profile</h1>
        <div className="mb-3 text-[13px] text-text-muted">{me?.email}</div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            updateName.mutate({ name: String(form.get("name")) });
          }}
        >
          <input
            name="name"
            defaultValue={me?.name ?? ""}
            placeholder="Your name"
            className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[14px] outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={updateName.isPending}
            className="rounded-lg bg-accent-fill px-4 py-2 text-[13.5px] font-semibold text-accent-ink hover:opacity-90"
          >
            Save
          </button>
        </form>
      </section>

      <section className="rounded-[20px] border border-border-soft bg-surface p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Accounts</h2>
          <button
            onClick={() => {
              setEditingAccount(null);
              setShowAccountForm((v) => !v);
            }}
            className="text-[12.5px] font-medium text-accent hover:opacity-80"
          >
            {showAccountForm ? "Cancel" : "+ Add account"}
          </button>
        </div>

        {showAccountForm && (
          <AccountForm
            submitLabel="Create account"
            members={members}
            currentUserId={currentUserId}
            onSubmit={(values) => createAccount.mutate(values)}
            pending={createAccount.isPending}
          />
        )}

        {editingAccount && (
          <AccountForm
            submitLabel="Save"
            initial={editingAccount}
            members={members}
            currentUserId={currentUserId}
            onSubmit={(values) => updateAccount.mutate({ id: editingAccount.id, ...values })}
            pending={updateAccount.isPending}
          />
        )}

        {assets && assets.length > 0 && (
          <>
            <p className="mt-4 mb-2 text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
              Assets
            </p>
            {assets.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                members={members}
                currentUserId={currentUserId}
                onEdit={() => {
                  setShowAccountForm(false);
                  setEditingAccount(a);
                }}
                onDelete={() => {
                  if (confirm(`Delete "${a.name}"?`)) deleteAccount.mutate({ id: a.id });
                }}
              />
            ))}
          </>
        )}

        {liabilities && liabilities.length > 0 && (
          <>
            <p className="mt-4 mb-2 text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
              Liabilities
            </p>
            {liabilities.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                members={members}
                currentUserId={currentUserId}
                onEdit={() => {
                  setShowAccountForm(false);
                  setEditingAccount(a);
                }}
                onDelete={() => {
                  if (confirm(`Delete "${a.name}"?`)) deleteAccount.mutate({ id: a.id });
                }}
              />
            ))}
          </>
        )}

        {accounts?.length === 0 && !showAccountForm && (
          <p className="text-[13px] text-text-muted">No accounts yet. Add your first one.</p>
        )}
      </section>

      <section className="rounded-[20px] border border-border-soft bg-surface p-6">
        <h2 className="mb-4 text-[15px] font-semibold">Categories</h2>
        {categories?.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-b border-border-soft py-2 last:border-none">
            <input
              type="color"
              defaultValue={c.color}
              onBlur={(e) => updateCategory.mutate({ id: c.id, color: e.target.value })}
              className="h-6 w-6 shrink-0 cursor-pointer rounded-full border border-border-soft bg-transparent"
            />
            <input
              defaultValue={c.name}
              onBlur={(e) => {
                if (e.target.value && e.target.value !== c.name) {
                  updateCategory.mutate({ id: c.id, name: e.target.value });
                }
              }}
              className="flex-1 rounded-lg bg-transparent px-2 py-1 text-[13.5px] outline-none focus:bg-surface-2"
            />
            <button
              onClick={() => deleteCategory.mutate({ id: c.id })}
              className="text-[12px] text-text-muted hover:text-critical"
            >
              Delete
            </button>
          </div>
        ))}

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newCategory.trim()) return;
            createCategory.mutate({ name: newCategory.trim(), color: newColor });
            setNewCategory("");
          }}
        >
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent"
          />
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category"
            className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[14px] outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-lg border border-border-soft px-4 py-2 text-[13.5px] font-medium text-text-muted hover:text-text"
          >
            Add
          </button>
        </form>
      </section>

      <section className="rounded-[20px] border border-border-soft bg-surface p-6">
        <h2 className="mb-1 text-[15px] font-semibold">Budgets · {monthLabel}</h2>
        <p className="mb-4 text-[13px] text-text-muted">
          Recurring each month, no rollover — unused budget simply resets next month.
        </p>

        {budgets?.length === 0 && <p className="mb-1 text-[13px] text-text-muted">No budgets set yet.</p>}

        {budgets?.map((b) => {
          const pct = b.monthlyAmount > 0 ? Math.min(100, (b.spent / b.monthlyAmount) * 100) : 0;
          return (
            <div key={b.id} className="border-b border-border-soft py-3 last:border-none">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="flex items-center gap-2 text-[13.5px] font-medium">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                  {b.categoryName}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[12.5px] text-text-muted tabular-nums">
                    <b className="font-semibold text-text">{formatEUR(b.spent)}</b> / {formatEUR(b.monthlyAmount)}
                  </span>
                  <InlineBudgetEdit
                    defaultValue={b.monthlyAmount}
                    onSave={(amount) => upsertBudget.mutate({ categoryId: b.categoryId, monthlyAmount: amount })}
                  />
                  <button
                    onClick={() => deleteBudget.mutate({ categoryId: b.categoryId })}
                    className="text-[12px] text-text-muted hover:text-critical"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="h-[7px] overflow-hidden rounded-full bg-surface-2">
                <div className={`h-full rounded-full ${BAR_CLASS[b.status]}`} style={{ width: `${pct}%` }} />
              </div>
              <span className={`mt-1.5 inline-block text-[11px] font-semibold ${STATUS_CLASS[b.status]}`}>
                {STATUS_LABEL[b.status]}
              </span>
            </div>
          );
        })}

        {unbudgeted && unbudgeted.length > 0 && (
          <>
            <p className="mt-4 mb-2 text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
              Not budgeted
            </p>
            {unbudgeted.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between border-b border-border-soft py-2.5 last:border-none"
              >
                <span className="flex items-center gap-2 text-[13.5px] font-medium">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </span>
                <InlineBudgetEdit onSave={(amount) => upsertBudget.mutate({ categoryId: c.id, monthlyAmount: amount })} />
              </div>
            ))}
          </>
        )}
      </section>

      <section className="rounded-[20px] border border-border-soft bg-surface p-6">
        <h2 className="mb-4 text-[15px] font-semibold">Household</h2>

        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const name = String(form.get("name") || "");
            if (name && name !== household?.name) renameHousehold.mutate({ name });
          }}
        >
          <input
            name="name"
            defaultValue={household?.name ?? ""}
            placeholder="Household name"
            className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[14px] outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={renameHousehold.isPending}
            className="rounded-lg bg-accent-fill px-4 py-2 text-[13.5px] font-semibold text-accent-ink hover:opacity-90"
          >
            Save
          </button>
        </form>

        <p className="mb-2 text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
          Members
        </p>
        {household?.members.map((m) => (
          <div
            key={m.user.id}
            className="flex items-center justify-between border-b border-border-soft py-2 text-[13.5px] last:border-none"
          >
            <span>{m.user.name || m.user.email}</span>
            {m.user.id === me?.id && (
              <span className="text-[11px] text-text-faint">You</span>
            )}
          </div>
        ))}

        <p className="mt-4 mb-2 text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
          Invite link
        </p>
        {household?.inviteCode && (
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-[13px] tracking-[0.06em]">
              {household.inviteCode}
            </code>
            <button
              onClick={copyInviteLink}
              className="rounded-lg border border-border-soft px-4 py-2 text-[13.5px] font-medium hover:bg-surface-2"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              onClick={() => {
                if (confirm("Regenerate the invite link? The current one will stop working."))
                  regenerateInvite.mutate();
              }}
              className="rounded-lg border border-border-soft px-4 py-2 text-[13.5px] font-medium text-text-muted hover:bg-surface-2 hover:text-text"
            >
              Regenerate
            </button>
          </div>
        )}
      </section>

      <section className="rounded-[20px] border border-border-soft bg-surface p-6">
        <h2 className="mb-1 text-[15px] font-semibold">Privacy</h2>
        <p className="mb-4 text-[13px] text-text-muted">
          Shared accounts and shared income/expenses are always visible to
          the whole household. This only controls your own personal items.
        </p>
        <label className="flex items-start gap-3 text-[13.5px]">
          <input
            type="checkbox"
            checked={me?.shareRecurringItems ?? true}
            onChange={(e) => updateSharing.mutate({ shareRecurringItems: e.target.checked })}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
          />
          <span>
            Share my income &amp; expenses with household
            <span className="mt-0.5 block text-[12px] text-text-muted">
              When on, other household members can see your personal
              recurring income and expenses in Budgeting. You always see
              your own, regardless.
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-[20px] border border-border-soft bg-surface p-6">
        <h2 className="mb-1 text-[15px] font-semibold">Export Data</h2>
        <p className="mb-4 text-[13px] text-text-muted">
          Your data belongs to you — download it anytime.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportCsv}
            className="rounded-lg border border-border-soft px-4 py-2 text-[13.5px] font-medium hover:bg-surface-2"
          >
            Transactions (CSV)
          </button>
          <button
            onClick={exportJson}
            className="rounded-lg border border-border-soft px-4 py-2 text-[13.5px] font-medium hover:bg-surface-2"
          >
            All data (JSON)
          </button>
        </div>
      </section>

      <section className="rounded-[20px] border border-border-soft bg-surface p-6">
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-lg border border-border-soft px-4 py-2 text-[13.5px] font-medium text-critical hover:bg-surface-2"
          >
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}

function AccountRow({
  account,
  members,
  currentUserId,
  onEdit,
  onDelete,
}: {
  account: Account;
  members: Member[];
  currentUserId: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const balance = Number(account.balance);
  const isLiability = !(ASSET_ACCOUNT_TYPES as readonly string[]).includes(account.type);

  const ownerLabel =
    members.length > 1
      ? account.ownerId === null
        ? "Shared"
        : account.ownerId === currentUserId
          ? "You"
          : (members.find((m) => m.user.id === account.ownerId)?.user.name ??
            members.find((m) => m.user.id === account.ownerId)?.user.email ??
            null)
      : null;

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-hover">
      <Link
        href={`/accounts/${account.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-border-soft bg-surface-2 text-text-muted">
          <span className="block h-4 w-4">
            <AccountTypeIcon type={account.type} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-medium hover:underline">{account.name}</div>
          <div className="truncate text-[12px] text-text-muted">
            {account.institution || ACCOUNT_TYPE_LABELS[account.type as AccountType]}
            {ownerLabel && ` · ${ownerLabel}`}
          </div>
        </div>
      </Link>
      <div className="text-[14px] font-semibold tabular-nums whitespace-nowrap">
        {isLiability ? "−" : ""}
        {formatEUR(Math.abs(balance))}
      </div>
      <div className="flex gap-1">
        <button
          onClick={onEdit}
          className="rounded-lg px-2 py-1 text-[12px] text-text-muted hover:bg-surface-2 hover:text-text"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg px-2 py-1 text-[12px] text-text-muted hover:bg-surface-2 hover:text-critical"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function AccountForm({
  initial,
  submitLabel,
  pending,
  members,
  currentUserId,
  onSubmit,
}: {
  initial?: Account;
  submitLabel: string;
  pending: boolean;
  members: Member[];
  currentUserId: string;
  onSubmit: (values: {
    name: string;
    institution?: string;
    type: (typeof ACCOUNT_TYPES)[number];
    startingBalance: number;
    ownerId?: string | null;
  }) => void;
}) {
  const showOwnerPicker = members.length > 1;

  return (
    <form
      className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border-soft bg-surface-2 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        // With no partner yet, default new/edited accounts to personal
        // (not shared) — otherwise they'd retroactively become visible to
        // whoever joins the household later, without an explicit choice.
        const ownerId = showOwnerPicker
          ? String(form.get("ownerId") || "") || null
          : currentUserId;
        onSubmit({
          name: String(form.get("name")),
          institution: String(form.get("institution") || "") || undefined,
          type: String(form.get("type")) as (typeof ACCOUNT_TYPES)[number],
          startingBalance: Number(form.get("startingBalance") || 0),
          ownerId,
        });
      }}
    >
      <input
        name="name"
        required
        defaultValue={initial?.name}
        placeholder="Account name"
        className="rounded-lg border border-border bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent"
      />
      <input
        name="institution"
        defaultValue={initial?.institution ?? ""}
        placeholder="Bank (optional)"
        className="rounded-lg border border-border bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent"
      />
      <select
        name="type"
        defaultValue={initial?.type ?? "CHECKING"}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent"
      >
        {ACCOUNT_TYPES.map((t) => (
          <option key={t} value={t}>
            {ACCOUNT_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      <div className="sm:col-span-1">
        <input
          name="startingBalance"
          type="number"
          step="0.01"
          required
          defaultValue={initial ? Number(initial.startingBalance) : undefined}
          placeholder="Starting balance (€)"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent"
        />
        <p className="mt-1 text-[11.5px] text-text-muted">
          The balance before any transactions — the current balance is
          calculated from this plus your transaction history.
        </p>
      </div>
      {showOwnerPicker && (
        <select
          name="ownerId"
          defaultValue={initial ? (initial.ownerId ?? "") : currentUserId}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent"
        >
          <option value="">Shared / Joint</option>
          {members.map((m) => (
            <option key={m.user.id} value={m.user.id}>
              {m.user.id === currentUserId ? "You" : (m.user.name ?? m.user.email)}
            </option>
          ))}
        </select>
      )}
      <button
        type="submit"
        disabled={pending}
        className="col-span-full rounded-lg bg-accent-fill py-2 text-[14px] font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </form>
  );
}

function InlineBudgetEdit({
  defaultValue,
  onSave,
}: {
  defaultValue?: number;
  onSave: (amount: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(defaultValue?.toString() ?? "");

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-[12px] font-medium text-accent hover:opacity-80"
      >
        {defaultValue ? "Edit" : "Set budget"}
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const amount = Number(value);
        if (amount > 0) onSave(amount);
        setEditing(false);
      }}
    >
      <input
        autoFocus
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="€ / month"
        className="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1 text-[13px] outline-none focus:border-accent"
      />
      <button type="submit" className="text-[12px] font-semibold text-accent">
        OK
      </button>
    </form>
  );
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

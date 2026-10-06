"use client";

import { useState } from "react";
import Link from "next/link";

import { trpc } from "@/trpc/react";
import { ACCOUNT_TYPE_LABELS, ASSET_ACCOUNT_TYPES, type AccountType } from "@/lib/constants";
import { formatEUR } from "@/lib/format";
import { AccountTypeIcon } from "@/components/account-type-icon";
import { groupLabel, groupOrder, type Member } from "@/components/finance/ownership-groups";
import { VisibilityToggle } from "@/components/finance/visibility-toggle";
import { Modal } from "@/components/modal";
import { Field, SelectInput, inputClass } from "@/components/settings/form";

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

type Account = {
  id: string;
  name: string;
  institution: string | null;
  type: string;
  startingBalance: unknown;
  balance: unknown;
  ownerId: string | null;
  visibleToHousehold: boolean;
};

export default function AccountsPage() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.user.me.useQuery();
  const { data: household } = trpc.household.current.useQuery();
  const { data: accounts } = trpc.account.list.useQuery();

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
  const updateVisibility = trpc.account.update.useMutation({
    onSuccess: () => utils.account.list.invalidate(),
  });
  const deleteAccount = trpc.account.delete.useMutation({
    onSuccess: () => {
      utils.account.list.invalidate();
      utils.dashboard.summary.invalidate();
    },
  });

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const members: Member[] = household?.members ?? [];
  const currentUserId = me?.id ?? "";

  const assets = accounts?.filter((a) => (ASSET_ACCOUNT_TYPES as readonly string[]).includes(a.type));
  const liabilities = accounts?.filter((a) => !(ASSET_ACCOUNT_TYPES as readonly string[]).includes(a.type));

  return (
    <section className="rounded-[20px] border border-border-soft bg-surface p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">Accounts</h2>
        <button
          onClick={() => {
            setEditingAccount(null);
            setShowAccountForm(true);
          }}
          className="text-[12.5px] font-medium text-accent hover:opacity-80"
        >
          + Add account
        </button>
      </div>

      {showAccountForm && (
        <Modal title="New account" onClose={() => setShowAccountForm(false)}>
        <AccountForm
          submitLabel="Create account"
          members={members}
          currentUserId={currentUserId}
          onSubmit={(values) => createAccount.mutate(values)}
          onCancel={() => setShowAccountForm(false)}
          pending={createAccount.isPending}
        />
        </Modal>
      )}

      {editingAccount && (
        <Modal title="Edit account" onClose={() => setEditingAccount(null)}>
        <AccountForm
          submitLabel="Save"
          initial={editingAccount}
          members={members}
          currentUserId={currentUserId}
          onSubmit={(values) => updateAccount.mutate({ id: editingAccount.id, ...values })}
          onCancel={() => setEditingAccount(null)}
          pending={updateAccount.isPending}
        />
        </Modal>
      )}

      {assets && assets.length > 0 && (
        <>
          <p className="mt-4 mb-2 text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
            Assets
          </p>
          {groupOrder(members, currentUserId)
            .filter((ownerId) => assets.some((a) => a.ownerId === ownerId))
            .map((ownerId) => (
              <div key={ownerId ?? "shared"}>
                {members.length > 1 && (
                  <p className="mt-3 mb-1 text-[10.5px] font-medium text-text-faint">
                    {groupLabel(ownerId, members, currentUserId)}
                  </p>
                )}
                {assets
                  .filter((a) => a.ownerId === ownerId)
                  .map((a) => (
                    <AccountRow
                      key={a.id}
                      account={a}
                      currentUserId={currentUserId}
                      onEdit={() => {
                        setShowAccountForm(false);
                        setEditingAccount(a);
                      }}
                      onDelete={() => {
                        if (confirm(`Delete "${a.name}"?`)) deleteAccount.mutate({ id: a.id });
                      }}
                      onToggleVisibility={(visible) =>
                        updateVisibility.mutate({ id: a.id, visibleToHousehold: visible })
                      }
                    />
                  ))}
              </div>
            ))}
        </>
      )}

      {liabilities && liabilities.length > 0 && (
        <>
          <p className="mt-4 mb-2 text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
            Liabilities
          </p>
          {groupOrder(members, currentUserId)
            .filter((ownerId) => liabilities.some((a) => a.ownerId === ownerId))
            .map((ownerId) => (
              <div key={ownerId ?? "shared"}>
                {members.length > 1 && (
                  <p className="mt-3 mb-1 text-[10.5px] font-medium text-text-faint">
                    {groupLabel(ownerId, members, currentUserId)}
                  </p>
                )}
                {liabilities
                  .filter((a) => a.ownerId === ownerId)
                  .map((a) => (
                    <AccountRow
                      key={a.id}
                      account={a}
                      currentUserId={currentUserId}
                      onEdit={() => {
                        setShowAccountForm(false);
                        setEditingAccount(a);
                      }}
                      onDelete={() => {
                        if (confirm(`Delete "${a.name}"?`)) deleteAccount.mutate({ id: a.id });
                      }}
                      onToggleVisibility={(visible) =>
                        updateVisibility.mutate({ id: a.id, visibleToHousehold: visible })
                      }
                    />
                  ))}
              </div>
            ))}
        </>
      )}

      {accounts?.length === 0 && !showAccountForm && (
        <p className="text-[13px] text-text-muted">No accounts yet. Add your first one.</p>
      )}
    </section>
  );
}

function AccountRow({
  account,
  currentUserId,
  onEdit,
  onDelete,
  onToggleVisibility,
}: {
  account: Account;
  currentUserId: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisibility: (visible: boolean) => void;
}) {
  const balance = Number(account.balance);
  const isLiability = !(ASSET_ACCOUNT_TYPES as readonly string[]).includes(account.type);
  const isOwnPersonal = account.ownerId === currentUserId;
  const canEdit = account.ownerId === null || account.ownerId === currentUserId;

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-hover">
      <Link
        href={`/finance/accounts/${account.id}`}
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
          </div>
        </div>
      </Link>
      {isOwnPersonal && (
        <VisibilityToggle visible={account.visibleToHousehold} onChange={onToggleVisibility} />
      )}
      <div className="text-[14px] font-semibold tabular-nums whitespace-nowrap">
        {isLiability ? "−" : ""}
        {formatEUR(Math.abs(balance))}
      </div>
      {canEdit && (
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
      )}
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
  onCancel,
}: {
  initial?: Account;
  submitLabel: string;
  pending: boolean;
  members: Member[];
  currentUserId: string;
  onCancel: () => void;
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
      className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2"
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
      <Field label="Account name">
        <input
          name="name"
          required
          autoFocus
          defaultValue={initial?.name}
          placeholder="e.g. Daily spending"
          className={inputClass}
        />
      </Field>
      <Field label="Bank (optional)">
        <input
          name="institution"
          defaultValue={initial?.institution ?? ""}
          placeholder="e.g. bunq"
          className={inputClass}
        />
      </Field>
      <Field label="Type">
        <SelectInput name="type" defaultValue={initial?.type ?? "CHECKING"}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACCOUNT_TYPE_LABELS[t]}
            </option>
          ))}
        </SelectInput>
      </Field>
      {showOwnerPicker && (
        <Field label="Owner">
          <SelectInput name="ownerId" defaultValue={initial ? (initial.ownerId ?? "") : currentUserId}>
            <option value="">Shared / Joint</option>
            {members.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.id === currentUserId ? "You" : (m.user.name ?? m.user.email)}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}
      <div className="flex flex-col gap-2">
        <Field label="Starting balance (€)">
          <input
            name="startingBalance"
            type="number"
            step="0.01"
            required
            defaultValue={initial ? Number(initial.startingBalance) : undefined}
            placeholder="0.00"
            className={inputClass}
          />
        </Field>
        <p className="text-[12px] text-text-muted">
          The balance before any transactions — the current balance is calculated from this plus your
          transaction history.
        </p>
      </div>
      <div className="col-span-full flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent-fill px-5 py-2.5 text-[13.5px] font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-border px-5 py-2.5 text-[13.5px] font-medium text-text-muted hover:bg-surface-hover hover:text-text"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

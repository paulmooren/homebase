"use client";

import { useEffect, useRef, useState } from "react";

import { trpc } from "@/trpc/react";
import { Avatar } from "@/components/avatar";
import { ModuleGate } from "@/components/use-modules";
import { VisibilityToggle, VisibilityBadge } from "@/components/finance/visibility-toggle";
import { VaultEntryForm } from "@/components/vault/entry-form";
import { expiryLabel } from "@/lib/vault";
import { formatDate } from "@/lib/format";
import { PencilIcon, TrashIcon } from "@/components/action-icons";

/** A revealed entry hides itself again after this long. */
const AUTO_HIDE_MS = 60_000;

type Revealed = { fields: { label: string; value: string }[]; note: string | null };

export default function VaultPage() {
  return (
    <ModuleGate module="vault">
      <Vault />
    </ModuleGate>
  );
}

function Vault() {
  const utils = trpc.useUtils();
  const { data: entries } = trpc.vault.list.useQuery();
  const { data: me } = trpc.user.me.useQuery();
  const { data: household } = trpc.household.current.useQuery();

  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, Revealed>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Never leave decrypted values sitting in memory after leaving the page.
  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  const refresh = () => utils.vault.list.invalidate();
  const create = trpc.vault.create.useMutation({
    onSuccess: () => {
      refresh();
      setCreating(false);
    },
  });
  const update = trpc.vault.update.useMutation({
    onSuccess: (_d, vars) => {
      refresh();
      hide(vars.id);
      setEditing(null);
    },
  });
  const remove = trpc.vault.delete.useMutation({ onSuccess: refresh });
  const setVisibility = trpc.vault.setVisibility.useMutation({ onSuccess: refresh });
  const reveal = trpc.vault.reveal.useMutation();

  function hide(id: string) {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setRevealed((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function show(id: string) {
    const data = await reveal.mutateAsync({ id });
    setRevealed((prev) => ({ ...prev, [id]: { fields: data.fields, note: data.note } }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => hide(id), AUTO_HIDE_MS);
    return data;
  }

  if (!entries || !me) return null;

  const members = household?.members ?? [];
  const multiMember = members.length > 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-text-muted">
          Numbers and notes are encrypted and stay hidden until you reveal them.
        </p>
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="shrink-0 rounded-xl bg-accent-fill px-4 py-2.5 text-[13.5px] font-semibold text-accent-ink hover:opacity-90"
        >
          {creating ? "Cancel" : "+ New entry"}
        </button>
      </div>

      {creating && (
        <section className="rounded-[20px] border border-border-soft bg-surface">
          <VaultEntryForm
            pending={create.isPending}
            onSubmit={(values) => create.mutate(values)}
            onCancel={() => setCreating(false)}
          />
          {create.error && <p className="px-6 pb-4 text-[12.5px] text-critical">{create.error.message}</p>}
        </section>
      )}

      {entries.length === 0 && !creating && (
        <p className="rounded-[20px] border border-border-soft bg-surface px-6 py-8 text-[13.5px] text-text-muted">
          Nothing in the Vault yet. Add your passport number, policy numbers, account numbers — anything you&apos;d
          otherwise dig around for.
        </p>
      )}

      {entries.map((entry) => {
        const isShared = entry.ownerId === null;
        const isMine = entry.ownerId === me.id;
        const canEdit = isShared || isMine;
        const owner = members.find((m) => m.user.id === entry.ownerId);
        const data = revealed[entry.id];
        const expiry = entry.expiresOn ? expiryLabel(entry.expiresOn) : null;

        return (
          <section key={entry.id} className="overflow-hidden rounded-[20px] border border-border-soft bg-surface">
            {editing === entry.id && data ? (
              <VaultEntryForm
                initial={{
                  title: entry.title,
                  category: entry.category,
                  expiresOn: entry.expiresOn,
                  shared: isShared,
                  fields: data.fields,
                  note: data.note,
                }}
                pending={update.isPending}
                onSubmit={(values) => update.mutate({ id: entry.id, ...values })}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="px-4 py-4 md:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[16px] font-semibold">{entry.title}</h2>
                      <span className="rounded-full border border-border-soft bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-text-muted">
                        {entry.category}
                      </span>
                      {expiry && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            expiry.critical ? "bg-critical/10 text-critical" : "bg-surface-2 text-text-muted"
                          }`}
                          title={formatDate(entry.expiresOn!)}
                        >
                          {expiry.text}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-text-muted">
                      {multiMember && !isShared && owner && (
                        <Avatar name={owner.user.name || owner.user.email} image={owner.user.image} size={18} />
                      )}
                      <span>
                        {isShared ? "Shared" : isMine ? "Personal" : `${owner?.user.name || owner?.user.email}'s`}
                        {!data && entry.fieldLabels.length > 0 && ` · ${entry.fieldLabels.join(", ")}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[12.5px] font-medium">
                    {isMine && (
                      <VisibilityToggle
                        visible={entry.visibleToHousehold}
                        pending={setVisibility.isPending}
                        onChange={(visible) => setVisibility.mutate({ id: entry.id, visible })}
                      />
                    )}
                    {!isMine && !isShared && <VisibilityBadge />}
                    {data ? (
                      <button type="button" onClick={() => hide(entry.id)} className="text-text-muted hover:text-text">
                        Hide
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => show(entry.id)}
                        disabled={reveal.isPending}
                        className="rounded-full border border-border px-3.5 py-1.5 text-text hover:border-text disabled:opacity-60"
                      >
                        Reveal
                      </button>
                    )}
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          aria-label={`Edit ${entry.title}`}
                          onClick={async () => {
                            if (!data) await show(entry.id);
                            setEditing(entry.id);
                          }}
                          className="h-4 w-4 text-text-faint hover:text-text"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${entry.title}`}
                          onClick={() => {
                            if (confirm(`Delete "${entry.title}" from the Vault?`)) remove.mutate({ id: entry.id });
                          }}
                          className="h-4 w-4 text-text-faint hover:text-critical"
                        >
                          <TrashIcon />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {data && (
                  <dl className="mt-4 flex flex-col gap-2.5 border-t border-border-soft pt-4">
                    {data.fields.map((field, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <dt className="w-40 shrink-0 text-[12.5px] text-text-muted">{field.label}</dt>
                        <dd className="min-w-0 flex-1 break-all font-mono text-[14px]">{field.value}</dd>
                        <CopyButton value={field.value} />
                      </div>
                    ))}
                    {data.note && (
                      <div className="mt-1 whitespace-pre-wrap rounded-xl bg-surface-2 px-3.5 py-3 text-[13.5px]">
                        {data.note}
                      </div>
                    )}
                    {data.fields.length === 0 && !data.note && (
                      <p className="text-[13px] text-text-muted">Nothing stored in this entry.</p>
                    )}
                  </dl>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-[12px] font-medium text-accent hover:opacity-80"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

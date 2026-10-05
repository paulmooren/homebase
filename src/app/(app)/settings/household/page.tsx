"use client";

import { useState } from "react";

import { trpc } from "@/trpc/react";
import { Avatar } from "@/components/avatar";
import { Field, SettingsSection, UpdateButton, inputClass } from "@/components/settings/form";

export default function HouseholdSettingsPage() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.user.me.useQuery();
  const { data: household } = trpc.household.current.useQuery();
  const renameHousehold = trpc.household.rename.useMutation({
    onSuccess: () => utils.household.current.invalidate(),
  });
  const regenerateInvite = trpc.household.regenerateInvite.useMutation({
    onSuccess: () => utils.household.current.invalidate(),
  });
  const [name, setName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const value = name ?? household?.name ?? "";
  const dirty = !!household && value.trim() !== "" && value.trim() !== household.name;

  async function copyInviteLink() {
    if (!household?.inviteCode) return;
    await navigator.clipboard.writeText(
      `${window.location.origin}/household-setup?join=${household.inviteCode}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <SettingsSection title="Household">
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty) renameHousehold.mutate({ name: value.trim() }, { onSuccess: () => setName(null) });
          }}
        >
          <Field label="Household name">
            <input
              value={value}
              onChange={(e) => setName(e.target.value)}
              placeholder="Household name"
              className={inputClass}
            />
          </Field>
          <UpdateButton disabled={!dirty || renameHousehold.isPending} />
        </form>
      </SettingsSection>

      <SettingsSection title="Members">
        <div>
          {household?.members.map((m) => (
            <div
              key={m.user.id}
              className="flex items-center gap-3 border-b border-border-soft py-3 text-[13.5px] last:border-none"
            >
              <Avatar name={m.user.name || m.user.email} image={m.user.image} size={32} />
              <span className="flex-1">{m.user.name || m.user.email}</span>
              {m.user.id === me?.id && <span className="text-[11px] text-text-faint">You</span>}
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Invite link">
        {household?.inviteCode && (
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 rounded-xl border border-border-soft bg-surface-2 px-3.5 py-3 text-[13px] tracking-[0.06em]">
              {household.inviteCode}
            </code>
            <button
              onClick={copyInviteLink}
              className="rounded-xl border border-border-soft px-4 py-2.5 text-[13.5px] font-medium hover:bg-surface-2"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              onClick={() => {
                if (confirm("Regenerate the invite link? The current one will stop working."))
                  regenerateInvite.mutate();
              }}
              className="rounded-xl border border-border-soft px-4 py-2.5 text-[13.5px] font-medium text-text-muted hover:bg-surface-2 hover:text-text"
            >
              Regenerate
            </button>
          </div>
        )}
      </SettingsSection>
    </>
  );
}

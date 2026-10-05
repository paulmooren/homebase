"use client";

import { useState } from "react";

import { trpc } from "@/trpc/react";
import { Avatar } from "@/components/avatar";
import { Field, SettingsSection, UpdateButton, inputClass } from "@/components/settings/form";
import { fileToAvatarDataUrl } from "@/lib/image";
import { signOutAction } from "../actions";

export default function ProfileSettingsPage() {
  return (
    <>
      <ProfileSection />
      <SecuritySection />
      <SettingsSection title="Session">
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-xl border border-border-soft px-5 py-2.5 text-[13.5px] font-medium text-critical hover:bg-surface-2"
          >
            Sign out
          </button>
        </form>
      </SettingsSection>
    </>
  );
}

function ProfileSection() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.user.me.useQuery();
  const updateName = trpc.user.updateName.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  });
  const updateAvatar = trpc.user.updateAvatar.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate();
      utils.household.current.invalidate();
    },
  });
  const [name, setName] = useState<string | null>(null);
  const value = name ?? me?.name ?? "";
  const dirty = !!me && value.trim() !== "" && value.trim() !== (me.name ?? "");

  return (
    <SettingsSection title="Profile">
      <div className="flex items-center gap-4">
        <Avatar name={me?.name || me?.email || ""} image={me?.image} size={64} />
        <div className="flex items-center gap-4 text-[13px] font-medium">
          <label className="cursor-pointer rounded-xl border border-border-soft px-4 py-2 hover:bg-surface-2">
            {me?.image ? "Change picture" : "Upload picture"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  updateAvatar.mutate({ image: await fileToAvatarDataUrl(file) });
                } catch {
                  alert("Couldn't read that image — try a JPG or PNG.");
                }
              }}
            />
          </label>
          {me?.image && (
            <button
              type="button"
              onClick={() => updateAvatar.mutate({ image: null })}
              className="text-text-muted hover:text-critical"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!dirty) return;
          updateName.mutate({ name: value.trim() }, { onSuccess: () => setName(null) });
        }}
      >
        <Field label="Name">
          <input
            value={value}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Your name"
            className={inputClass}
          />
        </Field>
        <Field label="Email">
          <input value={me?.email ?? ""} disabled readOnly className={inputClass} />
        </Field>
        <UpdateButton disabled={!dirty || updateName.isPending} />
      </form>
    </SettingsSection>
  );
}

function SecuritySection() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.user.me.useQuery();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const changePassword = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate();
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage({ text: "Password updated.", ok: true });
    },
    onError: (err) => setMessage({ text: err.message, ok: false }),
  });

  const hasPassword = me?.hasPassword ?? false;
  const mismatch = confirm.length > 0 && next !== confirm;
  const ready = next.length >= 8 && next === confirm && (!hasPassword || current.length > 0);

  return (
    <SettingsSection title="Security">
      {me && !hasPassword && (
        <p className="-mt-2 text-[13px] text-text-muted">
          You sign in with Google. Set a password if you also want to sign in with your email.
        </p>
      )}
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          setMessage(null);
          changePassword.mutate({
            currentPassword: hasPassword ? current : undefined,
            newPassword: next,
          });
        }}
      >
        {hasPassword && (
          <Field label="Current password">
            <input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="Current password"
              className={inputClass}
            />
          </Field>
        )}
        <Field label="New password">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="New password (min. 8 characters)"
              className={`${inputClass} pr-16`}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-3.5 text-[12px] font-medium text-text-muted hover:text-text"
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </Field>
        <Field label="Confirm new password">
          <input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            className={inputClass}
          />
        </Field>
        {mismatch && <p className="-mt-2 text-[12.5px] text-critical">Passwords don&apos;t match.</p>}
        {message && (
          <p className={`-mt-2 text-[12.5px] ${message.ok ? "text-good" : "text-critical"}`}>{message.text}</p>
        )}
        <UpdateButton disabled={!ready || changePassword.isPending}>
          {hasPassword ? "Update" : "Set password"}
        </UpdateButton>
      </form>
    </SettingsSection>
  );
}

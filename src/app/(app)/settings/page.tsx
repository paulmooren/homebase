"use client";

import { useState } from "react";

import { trpc } from "@/trpc/react";
import { Avatar } from "@/components/avatar";
import { fileToAvatarDataUrl } from "@/lib/image";
import { signOutAction } from "./actions";

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.user.me.useQuery();
  const { data: categories } = trpc.category.list.useQuery();
  const { data: household } = trpc.household.current.useQuery();

  const updateName = trpc.user.updateName.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  });
  const updateAvatar = trpc.user.updateAvatar.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate();
      utils.household.current.invalidate();
    },
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

  const [newCategory, setNewCategory] = useState("");
  const [newColor, setNewColor] = useState("#7fb8e8");
  const [copied, setCopied] = useState(false);

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
        <div className="mb-4 flex items-center gap-4">
          <Avatar name={me?.name || me?.email || ""} image={me?.image} size={56} />
          <div>
            <div className="mb-1.5 text-[13px] text-text-muted">{me?.email}</div>
            <div className="flex items-center gap-3 text-[12.5px] font-medium">
              <label className="cursor-pointer text-accent hover:opacity-80">
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
        </div>
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

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

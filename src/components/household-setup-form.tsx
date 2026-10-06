"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { trpc } from "@/trpc/react";

type Mode = "create" | "join";

export function HouseholdSetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillCode = searchParams.get("join") ?? "";
  const [mode, setMode] = useState<Mode>(prefillCode ? "join" : "create");

  const create = trpc.household.create.useMutation({
    onSuccess: () => {
      router.refresh();
      router.push("/dashboard");
    },
  });
  const join = trpc.household.join.useMutation({
    onSuccess: () => {
      router.refresh();
      router.push("/dashboard");
    },
  });

  const pending = create.isPending || join.isPending;
  const error = create.error?.message ?? join.error?.message;

  return (
    <div className="w-full">
      <div className="mb-6 flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-accent-fill md:hidden">
        <span className="pl-[2px] font-display text-[21px] font-bold text-accent-ink">K</span>
      </div>

      <p className="mb-2 text-[11px] font-semibold tracking-[0.11em] text-accent uppercase">
        Household setup
      </p>
      <h1 className="mb-2 font-display font-bold tracking-tight text-[26px]">Set up your household</h1>
      <p className="mb-6 text-[13.5px] leading-relaxed text-text-muted">
        Every account belongs to a household — create a new one, or join one
        you&apos;ve been invited to.
      </p>

      <div className="mb-5 flex gap-1 rounded-xl border border-border-soft bg-surface-2 p-1">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-colors ${
            mode === "create" ? "bg-surface text-text" : "text-text-muted hover:text-text"
          }`}
        >
          Create household
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-colors ${
            mode === "join" ? "bg-surface text-text" : "text-text-muted hover:text-text"
          }`}
        >
          Join with code
        </button>
      </div>

      {mode === "create" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            create.mutate({ name: String(form.get("name")) });
          }}
        >
          <input
            name="name"
            required
            placeholder="e.g. The Mooren Household"
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text placeholder:text-text-faint outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-accent-fill py-2.5 text-[14px] font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {create.isPending ? "Creating…" : "Create household"}
          </button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            join.mutate({ code: String(form.get("code")) });
          }}
        >
          <input
            name="code"
            required
            defaultValue={prefillCode}
            placeholder="Invite code"
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] tracking-[0.08em] text-text uppercase placeholder:text-text-faint placeholder:normal-case outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-accent-fill py-2.5 text-[14px] font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {join.isPending ? "Joining…" : "Join household"}
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-[13px] text-critical">{error}</p>}
    </div>
  );
}

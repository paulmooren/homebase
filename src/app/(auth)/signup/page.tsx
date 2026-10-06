import Link from "next/link";

import { AuthFrame } from "@/components/auth-frame";

import { signUpWithPassword } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  "weak-password": "Password must be at least 8 characters.",
  "email-taken": "That email is already registered — try signing in instead.",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "Something went wrong. Please try again.") : null;

  return (
    <AuthFrame>
      <div>
        <div className="mb-6 flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-accent-fill md:hidden">
          <span className="pl-[2px] font-display text-[21px] font-bold text-accent-ink">
            H
          </span>
        </div>

        <p className="mb-2 text-[11px] font-semibold tracking-[0.11em] text-accent uppercase">
          Create account
        </p>
        <h1 className="mb-6 font-display font-bold tracking-tight text-[26px]">Join Homebase</h1>

        {errorMessage && (
          <p className="mb-4 rounded-lg border border-critical/30 bg-critical/10 px-3.5 py-2.5 text-[13px] text-critical">
            {errorMessage}
          </p>
        )}

        <form action={signUpWithPassword} className="flex flex-col gap-3">
          <input
            type="text"
            name="name"
            placeholder="Your name (optional)"
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text placeholder:text-text-faint outline-none focus:border-accent"
          />
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text placeholder:text-text-faint outline-none focus:border-accent"
          />
          <input
            type="password"
            name="password"
            required
            minLength={8}
            placeholder="Password (min. 8 characters)"
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text placeholder:text-text-faint outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-accent-fill py-2.5 text-[14px] font-semibold text-accent-ink transition-opacity hover:opacity-90"
          >
            Create account
          </button>
        </form>

        <p className="mt-5 text-center text-[13px] text-text-muted">
          Already have an account?{" "}
          <Link href="/signin" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthFrame>
  );
}

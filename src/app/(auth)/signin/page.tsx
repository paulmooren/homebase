import Link from "next/link";

import { AuthFrame } from "@/components/auth-frame";

import { DEMO_PERSONAS, isDemoServer } from "@/lib/demo";

import { signInAsPersona, signInWithGoogle, signInWithPassword } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Incorrect email or password.",
  OAuthAccountNotLinked:
    "That email is already registered a different way — try signing in with Google or a password, whichever you used before.",
};

export default async function SignInPage({
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
          Sign in
        </p>
        <h1 className="mb-6 font-display font-bold tracking-tight text-[26px]">Welcome to Homebase</h1>

        {errorMessage && (
          <p className="mb-4 rounded-lg border border-critical/30 bg-critical/10 px-3.5 py-2.5 text-[13px] text-critical">
            {errorMessage}
          </p>
        )}

        {isDemoServer() ? (
          <div className="flex flex-col gap-3">
            <p className="text-[13.5px] text-text-muted">
              A household with made-up money. Sign in as either person — switch whenever you like.
            </p>
            {DEMO_PERSONAS.map((p) => (
              <form key={p.key} action={signInAsPersona}>
                <input type="hidden" name="persona" value={p.key} />
                <button
                  type="submit"
                  className="flex w-full flex-col items-start rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className="text-[14.5px] font-semibold">Continue as {p.name}</span>
                  <span className="text-[12.5px] text-text-muted">{p.blurb}</span>
                </button>
              </form>
            ))}
          </div>
        ) : (
          <SignInOptions />
        )}
      </div>
    </AuthFrame>
  );
}

function SignInOptions() {
  return (
    <>
        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface py-2.5 text-[14px] font-semibold text-text transition-colors hover:bg-surface-hover"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]">
              <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3.01h3.87c2.27-2.09 3.58-5.17 3.58-8.83Z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.87-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A11.99 11.99 0 0 0 12 24Z" />
              <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11Z" />
              <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75Z" />
            </svg>
            Continue with Google
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border-soft" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-text-faint">or</span>
          <div className="h-px flex-1 bg-border-soft" />
        </div>

        <form action={signInWithPassword} className="flex flex-col gap-3">
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
            placeholder="Password"
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text placeholder:text-text-faint outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-accent-fill py-2.5 text-[14px] font-semibold text-accent-ink transition-opacity hover:opacity-90"
          >
            Sign in
          </button>
        </form>

        <p className="mt-5 text-center text-[13px] text-text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-accent hover:underline">
            Create one
          </Link>
        </p>
    </>
  );
}

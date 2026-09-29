import { signInWithEmail } from "./actions";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[380px] rounded-[20px] border border-border-soft bg-surface p-8">
        <div className="mb-6 flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-accent-fill">
          <span className="pl-[2px] font-serif text-[21px] italic text-accent-ink">
            K
          </span>
        </div>

        <p className="mb-2 text-[11px] font-semibold tracking-[0.11em] text-accent uppercase">
          Sign in
        </p>
        <h1 className="mb-2 font-serif text-[26px]">Welcome to Kontor</h1>
        <p className="mb-6 text-[13.5px] leading-relaxed text-text-muted">
          Enter your email address — we&apos;ll send you a sign-in link, no
          password needed.
        </p>

        <form action={signInWithEmail} className="flex flex-col gap-3">
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-[14px] text-text placeholder:text-text-faint outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-accent-fill py-2.5 text-[14px] font-semibold text-accent-ink transition-opacity hover:opacity-90"
          >
            Send sign-in link
          </button>
        </form>
      </div>
    </div>
  );
}

/** Small pieces shared by the sign-in family of screens, so each page only holds its own words. */
export const authInputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text placeholder:text-text-faint outline-none focus:border-accent";

export const authPrimaryButtonClass =
  "w-full rounded-xl bg-accent-fill py-2.5 text-[14px] font-semibold text-accent-ink transition-opacity hover:opacity-90";

export function AuthHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <div className="mb-6 flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-accent-fill md:hidden">
        <span className="pl-[2px] font-display text-[21px] font-bold text-accent-ink">N</span>
      </div>
      <p className="mb-2 text-[11px] font-semibold tracking-[0.11em] text-accent uppercase">{eyebrow}</p>
      <h1 className="mb-6 font-display font-bold tracking-tight text-[26px]">{title}</h1>
    </>
  );
}

export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 rounded-lg border border-critical/30 bg-critical/10 px-3.5 py-2.5 text-[13px] text-critical">
      {children}
    </p>
  );
}

export function AuthNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 rounded-lg border border-border bg-surface-hover px-3.5 py-2.5 text-[13px] text-text-muted">
      {children}
    </p>
  );
}

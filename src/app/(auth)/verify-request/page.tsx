export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[380px] rounded-[20px] border border-border-soft bg-surface p-8 text-center">
        <div className="mx-auto mb-6 flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-accent-fill">
          <span className="pl-[2px] font-serif text-[21px] italic text-accent-ink">
            K
          </span>
        </div>
        <h1 className="mb-2 font-serif text-[24px]">Check your inbox</h1>
        <p className="text-[13.5px] leading-relaxed text-text-muted">
          We&apos;ve sent you a sign-in link. Click it to sign in to Kontor —
          the link is valid for 24 hours.
        </p>
      </div>
    </div>
  );
}

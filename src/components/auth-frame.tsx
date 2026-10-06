/**
 * The frame for screens before you're in the app (sign in, sign up, household
 * setup): the same grey shell and white panel as the app itself, with the form
 * centred in the panel and the wordmark top left on the grey.
 */
export function AuthFrame({ children, width = "max-w-[380px]" }: { children: React.ReactNode; width?: string }) {
  return (
    <div className="relative min-h-screen bg-bg md:p-3">
      <div className="absolute top-8 left-8 hidden items-center gap-2.5 md:flex">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-accent-fill">
          <span className="font-display text-[16px] font-bold text-accent-ink">H</span>
        </div>
        <span className="font-display text-[17px] font-bold tracking-tight">Homebase</span>
      </div>
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12 md:min-h-[calc(100vh-1.5rem)] md:rounded-[24px]">
        <div className={`w-full ${width}`}>{children}</div>
      </div>
    </div>
  );
}

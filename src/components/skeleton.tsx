/** A quiet grey block that pulses; the building piece of every loading screen. Decorative, so hidden from screen readers. */
export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-surface-2 ${className}`} />;
}

/** Wraps a loading screen: announced once as "Loading…" and laid out like the page it stands in for. */
export function LoadingScreen({ children, className = "flex flex-col gap-5" }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

/** A card in the shape of the dashboard's and lists' cards: a heading line, then `rows` rows. */
export function CardBones({ rows = 4 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-border-soft bg-surface">
      <div className="flex items-baseline justify-between px-6 pt-6 pb-3">
        <Bone className="h-4 w-28" />
        <Bone className="h-3 w-16" />
      </div>
      <div className="border-t border-border-soft">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border-soft px-6 py-3.5 last:border-b-0">
            <Bone className="h-4 w-4 shrink-0 rounded-[4px]" />
            <Bone className="h-3.5 flex-1" />
            <Bone className="hidden h-3.5 w-16 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

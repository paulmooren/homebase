import { IS_DEMO_CLIENT } from "@/lib/demo";

/** Marks the Demo, so nobody mistakes it for the real app (or its numbers for real ones). Renders nothing elsewhere. */
export function DemoBadge({ className = "" }: { className?: string }) {
  if (!IS_DEMO_CLIENT) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium text-text-muted ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      Demo — made-up data
    </span>
  );
}

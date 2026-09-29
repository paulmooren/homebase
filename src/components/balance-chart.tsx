"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { buildPoints, smoothPath, areaPath, CHART_HEIGHT, PAD_X } from "@/lib/chart";
import { formatEUR, formatSignedEUR } from "@/lib/format";

const PRESETS = [
  { key: "1M", label: "1 M", days: 30 },
  { key: "3M", label: "3 M", days: 90 },
  { key: "6M", label: "6 M", days: 182 },
  { key: "1Y", label: "1 Y", days: 365 },
] as const;

type PresetKey = (typeof PRESETS)[number]["key"] | "custom";
export type Granularity = "day" | "week" | "month";

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export type BalancePoint = { date: string | Date; value: number };

// UTC midnight, not local midnight — must agree with the server's own
// definition of "today" (`todayUTC()` in the dashboard router), or a
// client ahead of UTC sends a `to` that excludes today's own data point.
function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function formatTickDate(date: string | Date, granularity: Granularity) {
  const d = new Date(date);
  if (granularity === "month") return d.toLocaleDateString("en-GB", { month: "short" });
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
}

function formatTooltipDate(date: string | Date, granularity: Granularity) {
  const d = new Date(date);
  if (granularity === "month") return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  if (granularity === "week")
    return `Week of ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Interactive balance-over-time chart: hover tooltip, period presets +
 * custom date range, Day/Week/Month granularity, and a viewBox width
 * measured live via ResizeObserver (so `preserveAspectRatio="none"` is a
 * 1:1 no-op instead of a non-uniform stretch). Owns all of its own UI
 * state and reports the effective {from, to, granularity} range to the
 * parent via `onRangeChange` — the parent runs its own query for that
 * range and passes the resulting series back in as `data`, so this
 * component never needs to know which tRPC query backs it.
 */
export function BalanceChart({
  label,
  data,
  currentValue,
  onRangeChange,
}: {
  label: string;
  data: BalancePoint[] | undefined;
  currentValue: number;
  onRangeChange: (range: { from: Date; to: Date; granularity: Granularity }) => void;
}) {
  const today = useMemo(() => startOfToday(), []);
  const [presetKey, setPresetKey] = useState<PresetKey>("6M");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { from, to } = useMemo(() => {
    if (presetKey === "custom") {
      const fallbackFrom = new Date(today);
      fallbackFrom.setDate(fallbackFrom.getDate() - 182);
      return {
        from: customFrom ? new Date(customFrom) : fallbackFrom,
        to: customTo ? new Date(customTo) : today,
      };
    }
    const preset = PRESETS.find((p) => p.key === presetKey)!;
    const from = new Date(today);
    from.setDate(from.getDate() - preset.days);
    return { from, to: today };
  }, [presetKey, customFrom, customTo, today]);

  useEffect(() => {
    onRangeChange({ from, to, granularity });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, granularity]);

  const values = useMemo(() => data?.map((d) => d.value) ?? [], [data]);
  const points = useMemo(() => buildPoints(values, width), [values, width]);
  const linePath = useMemo(() => smoothPath(points), [points]);
  const fillPath = useMemo(() => areaPath(points), [points]);
  const lastPoint = points[points.length - 1];

  const ticks = useMemo(() => {
    if (!data || data.length === 0) return [];
    const count = Math.min(6, data.length);
    const raw = Array.from({ length: count }, (_, i) => {
      const idx = Math.round((i * (data.length - 1)) / Math.max(count - 1, 1));
      const frac = count === 1 ? 0 : i / (count - 1);
      return { label: formatTickDate(data[idx].date, granularity), frac };
    });
    // Drop consecutive duplicate labels (e.g. two nearby buckets both
    // rounding to "May") but always keep the last one — it anchors "today".
    return raw.filter((t, i) => i === raw.length - 1 || t.label !== raw[i + 1]?.label);
  }, [data, granularity]);

  const delta = useMemo(() => {
    if (values.length < 1) return null;
    const first = values[0];
    const last = values[values.length - 1];
    const diff = last - first;
    const pct = first !== 0 ? (diff / first) * 100 : 0;
    return { diff, pct, negative: diff < 0 };
  }, [values]);

  const periodLabel =
    presetKey === "custom"
      ? `${isoDate(from).split("-").reverse().join("/")} – ${isoDate(to).split("-").reverse().join("/")}`
      : `last ${PRESETS.find((p) => p.key === presetKey)!.label.toLowerCase().replace(" ", "")}`;

  const hoveredRow = hoverIndex !== null ? data?.[hoverIndex] : undefined;
  const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : undefined;

  function handlePointer(e: React.PointerEvent<HTMLDivElement>) {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - relX);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  return (
    <section className="mb-5 rounded-[20px] border border-border-soft bg-surface p-6">
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="mb-2.5 text-[11px] font-semibold tracking-[0.11em] text-text-muted uppercase">
            {label}
          </p>
          <p className="font-serif text-[clamp(40px,6vw,60px)] leading-none tabular-nums">
            {formatEUR(currentValue)}
          </p>
          <div className="mt-3 flex items-center gap-2 text-[13.5px] text-text-muted">
            {delta && (
              <span
                className={`flex items-center gap-1 font-semibold tabular-nums ${
                  delta.negative ? "text-critical" : "text-good"
                }`}
              >
                {delta.negative ? "↓" : "↑"} {formatSignedEUR(delta.diff)} (
                {delta.pct >= 0 ? "+" : "−"}
                {Math.abs(delta.pct).toFixed(1)}
                {"%)"}
              </span>
            )}
            <span>· {periodLabel}</span>
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
          <div className="flex h-fit flex-wrap gap-0.5 rounded-[11px] border border-border-soft bg-surface-2 p-[3px]">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPresetKey(p.key)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                  p.key === presetKey
                    ? "bg-accent-fill font-semibold text-accent-ink"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setPresetKey("custom")}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                presetKey === "custom"
                  ? "bg-accent-fill font-semibold text-accent-ink"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Custom
            </button>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {presetKey === "custom" && (
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="date"
                  value={customFrom || isoDate(from)}
                  max={isoDate(to)}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-2 py-1 text-[12px] text-text outline-none focus:border-accent"
                />
                <span className="text-text-faint">–</span>
                <input
                  type="date"
                  value={customTo || isoDate(to)}
                  max={isoDate(today)}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-2 py-1 text-[12px] text-text outline-none focus:border-accent"
                />
              </div>
            )}
            <div className="flex h-fit gap-0.5 rounded-[9px] border border-border-soft bg-surface-2 p-[2px]">
              {GRANULARITIES.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setGranularity(g.key)}
                  className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                    g.key === granularity
                      ? "bg-surface font-semibold text-text shadow-sm"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-4" ref={containerRef}>
        <div
          className="touch-none"
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <svg
            viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            className="block h-[190px] w-full overflow-visible"
          >
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#18181b" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#18181b" stopOpacity="0" />
              </linearGradient>
              <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="3.2" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <line x1={PAD_X} y1="45" x2={width - PAD_X} y2="45" stroke="#e4e4e7" strokeWidth="1" />
            <line x1={PAD_X} y1="100" x2={width - PAD_X} y2="100" stroke="#e4e4e7" strokeWidth="1" />
            <line x1={PAD_X} y1="155" x2={width - PAD_X} y2="155" stroke="#e4e4e7" strokeWidth="1" />
            {points.length > 0 && (
              <>
                <path d={fillPath} fill="url(#areaGrad)" stroke="none" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="#18181b"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {hoveredPoint ? (
                  <>
                    <line
                      x1={hoveredPoint.x}
                      y1="0"
                      x2={hoveredPoint.x}
                      y2={CHART_HEIGHT - 20}
                      stroke="#a1a1aa"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="4.2" fill="#18181b" filter="url(#glow)" />
                  </>
                ) : (
                  <circle cx={lastPoint.x} cy={lastPoint.y} r="4.2" fill="#18181b" filter="url(#glow)" />
                )}
              </>
            )}
            {ticks.map((t, i) => (
              <text
                key={i}
                x={PAD_X + t.frac * (width - PAD_X * 2)}
                y={190}
                textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
                className="fill-text-faint text-[11px]"
              >
                {t.label}
              </text>
            ))}
          </svg>
        </div>

        {hoveredRow && hoveredPoint && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border-soft bg-surface px-2.5 py-1.5 text-[11.5px] whitespace-nowrap shadow-md"
            style={{ left: clamp(hoveredPoint.x, 55, width - 55), top: Math.max(hoveredPoint.y - 12, 0) }}
          >
            <div className="text-text-muted">{formatTooltipDate(hoveredRow.date, granularity)}</div>
            <div className="font-semibold tabular-nums">{formatEUR(Number(hoveredRow.value))}</div>
          </div>
        )}

        {points.length === 0 && (
          <p className="mt-[-140px] text-center text-[13px] text-text-faint">
            No history yet — check back in a few days.
          </p>
        )}
      </div>
    </section>
  );
}

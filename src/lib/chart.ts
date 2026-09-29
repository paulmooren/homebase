export type ChartPoint = { x: number; y: number };

export const CHART_HEIGHT = 200;
export const PAD_X = 30;
const PAD_TOP = 18;
const PAD_BOTTOM = 34;

/**
 * `width` should be the chart's *actual measured pixel width* — the viewBox
 * is then set to the same value by the caller, so `preserveAspectRatio="none"`
 * is a 1:1 no-op instead of a non-uniform stretch.
 */
export function buildPoints(values: number[], width: number): ChartPoint[] {
  if (values.length === 0) return [];
  const min0 = Math.min(...values);
  const max0 = Math.max(...values);
  const span0 = max0 - min0 || 1;
  const padSpan = span0 * 0.18;
  const min = min0 - padSpan;
  const max = max0 + padSpan;
  const span = max - min;

  const plotW = width - PAD_X * 2;
  const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  return values.map((v, i) => ({
    x: PAD_X + (values.length === 1 ? 0 : (plotW * i) / (values.length - 1)),
    y: PAD_TOP + plotH - ((v - min) / span) * plotH,
  }));
}

/** Eased flat-control-point smoothing — cheap, no dependency, reads well at this scale. */
export function smoothPath(points: ChartPoint[]): string {
  if (points.length === 0) return "";
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = p0.x + (p1.x - p0.x) / 3;
    const cx2 = p0.x + ((p1.x - p0.x) * 2) / 3;
    d += ` C ${cx.toFixed(1)},${p0.y.toFixed(1)} ${cx2.toFixed(1)},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }
  return d;
}

export function areaPath(points: ChartPoint[]): string {
  if (points.length === 0) return "";
  const line = smoothPath(points);
  const baseline = CHART_HEIGHT - PAD_BOTTOM + 14;
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L${last.x.toFixed(1)},${baseline} L${first.x.toFixed(1)},${baseline} Z`;
}

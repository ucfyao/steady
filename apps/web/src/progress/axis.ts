export interface YAxis {
  ticks: number[];
  labels: string[];
}

// No 2.5: with steps of 1, 2 or 5 and at least three ticks, labels that are all distinct are
// also exact (a 2.5% tick cannot pass as "3%").
const NICE = [1, 2, 5, 10];
const MIN_TICKS = 3;
const MAX_DECIMALS = 4;
// Guards floor/ceil against float noise such as 0.04 / 0.005 = 8.000000000000002.
const EPS = 1e-9;

/** The smallest 1, 2 or 5 × 10^k step that is at least `raw`. */
function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return NICE.find((n) => n * magnitude >= raw - EPS * magnitude)! * magnitude;
}

/**
 * Y-axis ticks for a metric chart: about five evenly spaced round values covering the data,
 * and labels with as few decimals as keep every label distinct. Recharts' own ticks can land
 * on 2.5% and 3.5%, which whole-percent formatting would show as a repeated "3%" and "4%".
 */
export function yAxis(
  values: number[],
  format: (v: number, decimals?: number) => string,
): YAxis | null {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const step = niceStep(range > 0 ? range / 4 : Math.abs(max) * 0.05 || 0.01);

  const first = Math.floor(min / step + EPS);
  let last = Math.ceil(max / step - EPS);
  while (last - first + 1 < MIN_TICKS) last += 1;
  const ticks = Array.from({ length: last - first + 1 }, (_, i) =>
    Number(((first + i) * step).toPrecision(12)),
  );

  for (let decimals = 0; ; decimals++) {
    const labels = ticks.map((t) => format(t, decimals));
    if (new Set(labels).size === labels.length || decimals === MAX_DECIMALS)
      return { ticks, labels };
  }
}

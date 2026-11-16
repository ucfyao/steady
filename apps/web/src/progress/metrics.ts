import type { BehaviourFlag, ProgressMetric } from '@steady/core';

/**
 * Chart axis labels for each metric, in shown units (names, directions and words come from
 * `src/metrics/metrics.ts`). Whole numbers unless `decimals` is given: narrow ranges need them.
 */
export type AxisFormat = (shown: number, decimals?: number) => string;

const fixed = (x: number, decimals = 0) =>
  decimals === 0 ? String(Math.round(x)) : x.toFixed(decimals);
const percent: AxisFormat = (x, decimals) => `${fixed(x * 100, decimals)}%`;
const ms: AxisFormat = (x, decimals) => `${fixed(x, decimals)} ms`;
const count: AxisFormat = (x, decimals) => fixed(x, decimals);

export const AXIS_FORMAT: Record<ProgressMetric, AxisFormat> = {
  commissionRate: percent,
  omissionRate: count,
  medianGoRtMs: ms,
  rtCv: percent,
};

/** Short flag names for chart tooltips; the results page explains them in full. */
export const FLAG_SHORT: Record<BehaviourFlag, string> = {
  high_omissions: 'many missed digits',
  many_anticipations: 'many early presses',
  regular_timing: 'unusually even timing',
};

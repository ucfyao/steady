import type { BehaviourFlag, ProgressMetric } from '@steady/core';

export interface MetricView {
  key: ProgressMetric;
  label: string;
  hint?: string;
  /** The server's value as shown: commission rate is shown as catch rate (Spec 002). */
  show(value: number): number;
  /** Whole numbers unless `decimals` is given (chart axes need them on narrow ranges). */
  format(shown: number, decimals?: number): string;
}

const fixed = (x: number, decimals = 0) =>
  decimals === 0 ? String(Math.round(x)) : x.toFixed(decimals);
const percent = (x: number, decimals?: number) => `${fixed(x * 100, decimals)}%`;
const ms = (x: number, decimals?: number) => `${fixed(x, decimals)} ms`;

export const METRIC_VIEWS: MetricView[] = [
  {
    key: 'commissionRate',
    label: 'Catch rate',
    hint: '3s you held back on',
    show: (v) => 1 - v,
    format: percent,
  },
  { key: 'omissionRate', label: 'Missed digits', show: (v) => v, format: percent },
  { key: 'medianGoRtMs', label: 'Median response', show: (v) => v, format: ms },
  {
    key: 'rtCv',
    label: 'Rhythm variability',
    hint: 'Lower is steadier',
    show: (v) => v,
    format: percent,
  },
];

export const metricView = (key: ProgressMetric) => METRIC_VIEWS.find((m) => m.key === key)!;

/** Short flag names for chart tooltips; the results page explains them in full. */
export const FLAG_SHORT: Record<BehaviourFlag, string> = {
  high_omissions: 'many missed digits',
  many_anticipations: 'many early presses',
  regular_timing: 'unusually even timing',
};

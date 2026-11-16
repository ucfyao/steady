import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ProgressMetric } from '@steady/core';
import { METRICS, directionText } from '../metrics/metrics.js';
import { yAxis } from './axis.js';
import { AXIS_FORMAT, FLAG_SHORT } from './metrics.js';
import styles from './MetricChart.module.css';
import type { SessionPoint } from './series.js';

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: SessionPoint;
}

/**
 * Practice sessions are a hollow circle; flagged sessions a hollow diamond in the warning
 * colour (Spec 004). Shape tells them apart without relying on colour.
 */
export function SessionDot({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  if (payload.flags.length > 0 && !payload.practice) {
    const r = 5.5;
    return (
      <path
        d={`M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`}
        className={styles.flagged}
        data-kind="flagged"
      />
    );
  }
  return payload.practice ? (
    <circle cx={cx} cy={cy} r={4.5} className={styles.practice} data-kind="practice" />
  ) : (
    <circle cx={cx} cy={cy} r={3.5} className={styles.normal} data-kind="normal" />
  );
}

const ARROW = { higher: '↑', lower: '↓' } as const;

/**
 * One metric over time (Spec 004): straight lines between sessions, and no text inside the
 * plot. The caption carries the better direction, the latest value and where the player
 * started, so nothing is drawn over the data.
 */
export function MetricChart({
  metric,
  points,
  value,
  baseline,
}: {
  metric: ProgressMetric;
  points: SessionPoint[];
  value(p: SessionPoint): number | null;
  /** The baseline median as shown, once it exists. */
  baseline: number | null;
}) {
  const def = METRICS[metric];
  const axisFormat = AXIS_FORMAT[metric];
  const data = points.map((p) => ({ ...p, value: value(p) }));
  const latest = [...data].reverse().find((d) => d.value !== null);
  const id = `chart-${metric}`;
  const shown = data.flatMap((d) => (d.value === null ? [] : [d.value]));
  const axis = yAxis(baseline === null ? shown : [...shown, baseline], axisFormat);
  const label = (v: number) => axis?.labels[axis.ticks.indexOf(v)] ?? axisFormat(v);

  return (
    <figure className={styles.chart} aria-labelledby={id}>
      <figcaption className={styles.caption}>
        <h3 id={id}>{def.name}</h3>
        <p className={styles.direction}>
          {def.better && <span aria-hidden="true">{ARROW[def.better]} </span>}
          {directionText(metric)}
        </p>
        <p className={styles.values}>
          <span>
            {latest ? (
              <>
                Latest: <span className={styles.value}>{def.format(latest.value!)}</span> (session{' '}
                {latest.session})
              </>
            ) : (
              'No value yet'
            )}
          </span>
          {baseline !== null && (
            <span className={styles.started}>
              <svg viewBox="0 0 16 12" aria-hidden="true">
                <line x1="0" y1="6" x2="16" y2="6" />
              </svg>
              Where you started: {def.format(baseline)}
            </span>
          )}
        </p>
      </figcaption>
      <div className={styles.plot} aria-hidden="true">
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="session" tickLine={false} allowDecimals={false} />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              ticks={axis?.ticks}
              tickFormatter={label}
              domain={axis ? [axis.ticks[0]!, axis.ticks.at(-1)!] : ['auto', 'auto']}
            />
            {baseline !== null && <ReferenceLine y={baseline} strokeDasharray="4 4" />}
            <Tooltip
              wrapperClassName={styles.tooltip}
              formatter={(v) => (typeof v === 'number' ? def.format(v) : '–')}
              labelFormatter={(_, payload) => {
                const p = payload[0]?.payload as SessionPoint | undefined;
                if (!p) return '';
                const notes = [
                  p.practice ? 'practice' : null,
                  ...p.flags.map((f) => FLAG_SHORT[f]),
                ].filter(Boolean);
                const date = new Date(p.completedAt).toLocaleDateString();
                return `Session ${p.session}, ${date}${notes.length ? ` (${notes.join(', ')})` : ''}`;
              }}
            />
            <Line
              type="linear"
              dataKey="value"
              name={def.name}
              className={styles.line}
              connectNulls
              isAnimationActive={false}
              dot={(props) => (
                <SessionDot
                  key={`dot-${props.index}`}
                  cx={props.cx}
                  cy={props.cy}
                  payload={props.payload as SessionPoint}
                />
              )}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

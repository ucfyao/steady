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
import { yAxis } from './axis.js';
import { FLAG_SHORT, type MetricView } from './metrics.js';
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

export function MetricChart({
  view,
  points,
  value,
  baseline,
}: {
  view: MetricView;
  points: SessionPoint[];
  value(p: SessionPoint): number | null;
  /** The baseline median as shown, once it exists. */
  baseline: number | null;
}) {
  const data = points.map((p) => ({ ...p, value: value(p) }));
  const latest = [...data].reverse().find((d) => d.value !== null);
  const id = `chart-${view.key}`;
  const shown = data.flatMap((d) => (d.value === null ? [] : [d.value]));
  const axis = yAxis(baseline === null ? shown : [...shown, baseline], view.format);
  const label = (v: number) => axis?.labels[axis.ticks.indexOf(v)] ?? view.format(v);

  return (
    <figure className={styles.chart} aria-labelledby={id}>
      <figcaption className={styles.caption}>
        <h3 id={id}>{view.label}</h3>
        <p className={styles.hint}>{view.hint}</p>
        <p className={styles.latest}>
          {latest ? (
            <>
              Latest: <span className={styles.value}>{view.format(latest.value!)}</span> (session{' '}
              {latest.session})
            </>
          ) : (
            'No value yet'
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
            {baseline !== null && (
              <ReferenceLine
                y={baseline}
                strokeDasharray="4 4"
                label={{ value: 'where you started', position: 'insideTopRight' }}
              />
            )}
            <Tooltip
              wrapperClassName={styles.tooltip}
              formatter={(v) => (typeof v === 'number' ? view.format(v) : '–')}
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
              type="monotone"
              dataKey="value"
              name={view.label}
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

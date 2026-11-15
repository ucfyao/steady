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
import { FLAG_SHORT, type MetricView } from './metrics.js';
import type { SessionPoint } from './series.js';

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: SessionPoint;
}

/** Practice sessions are hollow; flagged sessions get a warning outline (Spec 004). */
function SessionDot({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  const kind = payload.practice ? 'practice' : payload.flags.length > 0 ? 'flagged' : 'normal';
  return <circle cx={cx} cy={cy} r={kind === 'normal' ? 3.5 : 5} className={`dot dot-${kind}`} />;
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

  return (
    <figure className="chart" aria-labelledby={id}>
      <figcaption>
        <h3 id={id}>{view.label}</h3>
        <p className="chart-latest">
          {latest
            ? `Latest: ${view.format(latest.value!)} (session ${latest.session})`
            : 'No value yet'}
          {view.hint && <span className="chart-hint"> · {view.hint}</span>}
        </p>
      </figcaption>
      <div className="chart-plot" aria-hidden="true">
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} className="chart-grid" />
            <XAxis dataKey="session" tickLine={false} allowDecimals={false} />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => view.format(v)}
              domain={['auto', 'auto']}
            />
            {baseline !== null && (
              <ReferenceLine
                y={baseline}
                className="chart-baseline"
                strokeDasharray="4 4"
                label={{ value: 'where you started', position: 'insideTopRight' }}
              />
            )}
            <Tooltip
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
              className="chart-line"
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

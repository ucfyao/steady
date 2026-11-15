# Spec 002 — Progress: baselines and exploratory comparisons (`@steady/core`)

Status: implemented (`packages/core/src/progress.ts`)
Design note: `docs/design-note.md` §6

## Goal

Pure functions that turn one player's stored session scores into:

1. an **initial baseline** and **recent performance** for the progress card,
2. **exploratory comparisons**: sessions split by the sleep/stress check-in, and pre-probe variability split by probe answer.

They take data in, return data out, and know nothing about HTTP, the database or the clock. The API calls them for the authenticated player only.

## Input

`ProgressSession[]`, **oldest first** (the caller sorts by completion time). Every stored session is technically valid, because invalid submissions are rejected and never stored (Spec 001). Sessions with behavioural flags are included.

```ts
interface ProgressSession {
  score: Pick<SessionScore, 'commissionRate' | 'omissionRate' | 'medianGoRtMs' | 'rtCv' | 'probes'>;
  checkIn: CheckIn | null;
}
```

**Check-in [P]** (optional, before a session; each field may be omitted):

| Field  | Levels                  |
| ------ | ----------------------- |
| sleep  | `poor`, `ok`, `good`    |
| stress | `low`, `medium`, `high` |

Shared as `CheckInSchema` in `contracts.ts`, so the API and web app use the same definition.

**Metrics** (`ProgressMetric`): `commissionRate`, `omissionRate`, `medianGoRtMs`, `rtCv`. The UI shows commission rate as "catch rate" (1 − commission rate); core does not convert it.

## Constants (`PROGRESS_CONFIG`)

| Name               | Value                        | Source |
| ------------------ | ---------------------------- | ------ |
| practice sessions  | 1                            | [P]    |
| baseline sessions  | 5 (sessions 2–6)             | [P]    |
| recent window      | last 5 non-practice sessions | [P]    |
| minimum group size | 10                           | [P]    |

These do not change how a single session is scored, so they do not affect `scoringVersion`.

## 1. `summariseProgress(sessions): ProgressSummary`

```ts
interface MetricSummary {
  median: number | null;
  n: number;
}
type MetricSet = Record<ProgressMetric, MetricSummary>;
interface ProgressSummary {
  totalSessions: number;
  practiceSessions: number; // min(total, 1)
  sessionsUntilBaseline: number; // 0 once the baseline exists
  baseline: MetricSet | null;
  recent: MetricSet | null;
}
```

- Session 1 is practice. It is excluded from the baseline, recent and comparisons (the UI still plots it).
- **Baseline:** the per-metric median of sessions 2–6. It is `null` until 6 sessions exist. Because it only ever reads sessions 2–6, adding later sessions can never change it ("fixed once set").
- **Recent:** the per-metric median of the last 5 non-practice sessions. It is `null` until the baseline exists, so the card always has both reference points. With exactly 6 sessions, recent equals the baseline.
- A metric can be `null` in a single session (for example median RT with too few presses). Nulls are skipped; `n` is the number of non-null values, and `median` is `null` when `n` is 0.

## 2. `compareByCheckIn(sessions, dimension, metric): GroupComparison`

```ts
interface Group {
  key: string;
  n: number;
  values: number[];
  median: number | null;
}
interface GroupComparison {
  groups: Group[];
  canSummarise: boolean;
}
```

- `dimension` is `sleep` or `stress`. Groups are returned for **every level, in the fixed order above**, including empty ones.
- `values` are the per-session metric values (oldest first) for non-practice sessions that answered that dimension; null metric values are skipped.
- `median` is reported only when `n ≥ 10`, otherwise `null`, so the UI cannot over-read a small group. The dots (`values`) and `n` are always returned.
- `canSummarise` is true only when **at least two groups have `n ≥ 10`**. Only then may the UI show a sentence, worded as "a pattern so far, not a cause".

## 3. `comparePreProbe(sessions): GroupComparison`

- One group per probe answer (`on_task`, `drifting`, `elsewhere`), in that order.
- `values` are the non-null `preProbeCv` values from every probe in every non-practice session.
- Same `median` and `canSummarise` rules, with the same minimum of 10.

## Test cases (Vitest)

Expected values are worked out by hand from small fixtures, never by calling the module.

- 0 sessions: no baseline, no recent, `sessionsUntilBaseline` = 6, `practiceSessions` = 0.
- 5 sessions: still no baseline; `sessionsUntilBaseline` = 1.
- 6 sessions: baseline = median of sessions 2–6; the practice session's (extreme) values do not affect it; recent equals the baseline.
- Adding sessions 7–12 with very different values leaves the baseline unchanged and moves recent to the median of sessions 8–12.
- A metric that is null in some sessions: `n` counts non-null values; all-null gives `median: null, n: 0`.
- Check-in split: groups in fixed order including empty ones; practice session and sessions without that answer are excluded; `median` null below 10.
- `canSummarise`: false with one group at 10 and another at 9; true with two groups at 10.
- Pre-probe: values are collected across sessions per answer, null CVs are skipped, the practice session's probes are excluded.
- `CheckInSchema` accepts partial and empty check-ins, and rejects unknown levels.

## Out of scope

- The weekly 4-of-7 target. It depends on the player's local calendar days, so the web app computes it from completion timestamps.
- Charts and wording (web app). Persistence and endpoints (Spec 003).

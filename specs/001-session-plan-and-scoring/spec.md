# Spec 001 — Session plan and scoring (`@steady/core`)

Status: in progress (`packages/core`)
Design note: `docs/design-note.md` §3–5

## Goal

Pure, framework-free functions that:

1. build a deterministic session plan from a seed,
2. validate a submitted session against its plan (technical validity),
3. score a valid session from raw responses.

The API server calls these. The client never scores.

## Constants (`SART_CONFIG`)

| Name                                          | Value                               | Source                              |
| --------------------------------------------- | ----------------------------------- | ----------------------------------- |
| digits                                        | 1–9                                 | [R] Robertson 1997                  |
| target digit                                  | 3                                   | [R]                                 |
| copies per digit                              | 14 → 126 trials, 14 targets, 112 go | [P]                                 |
| stimulus / mask                               | 250 ms / 900 ms → trial 1150 ms     | [R] PsyToolkit                      |
| font sizes                                    | 5 (index 0–4)                       | [R] PsyToolkit                      |
| probes per session                            | 4                                   | [P]                                 |
| probe gap                                     | 25–35 trials                        | [P]                                 |
| last probe at or before trial index           | 120                                 | [P]                                 |
| warm-up trials (no targets; excluded from RT) | first 5                             | [P]                                 |
| post-probe trials (excluded from RT)          | 3 after each probe                  | [P]                                 |
| anticipation threshold                        | RT < 100 ms                         | [P], borrowed from PVT false starts |
| pre-probe window                              | 8 trials                            | [P], after Bastian & Sackur 2013    |
| scoring version                               | 1                                   | —                                   |

All of these live in one exported config object.

## 1. `createSessionPlan(seed: number): SessionPlan`

- Uses a seeded PRNG (mulberry32), so the same seed always produces the same plan.
- **Trials:** exactly 14 of each digit, and no two adjacent trials have the same digit.
  - Generation is a greedy weighted draw that never repeats the previous digit.
  - On a dead end, it retries with the next PRNG state. It throws after 1000 attempts, which should never happen.
- Each trial gets `fontSize` 0–4 from the PRNG.
- **Probes:** `probeAfter` is a list of 4 trial indices (0-based); the probe is shown after that trial.
  - The first probe falls at index 24–34. Each later one is 25–35 trials after the previous one.
  - If a candidate index is a target trial, it moves to the previous trial. Two targets are never adjacent, so that trial is always a go trial.
  - Candidates are redrawn until the last probe is at or before index 120.

## 2. `validateSubmission(plan, submission): ValidationResult`

`submission = { rts: (number | null)[], probeAnswers: ProbeAnswer[] }`

- `rts[i]` is the time in ms from stimulus onset to the first key press on trial `i`, or `null` for no press. Extra presses within a trial are ignored by the client.
- `ProbeAnswer` is `"on_task" | "drifting" | "elsewhere"`.

The result is `{ ok: true }` or `{ ok: false, errors: string[] }`. Errors are reported when:

- `rts.length` ≠ the number of trials in the plan;
- any RT is not `null` and not a finite number within `[0, 1150]`;
- `probeAnswers.length` ≠ `plan.probeAfter.length`, or an answer is not one of the allowed values.

Session duration checks need server timestamps, so they belong to the API, not this module.

## 3. `scoreSession(plan, submission): SessionScore`

The input must already be valid. Definitions:

- **Pressed:** `rt !== null`.
- **Commission:** pressed on a target. `commissionRate = commissions / 14`.
- **Omission:** not pressed on a go trial. `omissionRate = omissions / 112`.
- **Anticipation:** pressed with `rt < 100` (on any trial). Anticipations count as presses for accuracy.
- **Transition trial:** index < 5, or `p+1 … p+3` for any probe index `p`.
- **RT set:** go trials that were pressed, not anticipations, and not transition trials.
  - `medianGoRtMs`: the median of the RT set.
  - `rtCv`: sample SD (n − 1) divided by the mean.
  - Both are `null` if the RT set has fewer than 10 trials.
- **d′:** the response is withholding.
  - `hits = 14 − commissions` (withheld on a target)
  - `falseAlarms = omissions` (withheld on a go trial)
  - `H = (hits + 0.5) / (14 + 1)` and `F = (falseAlarms + 0.5) / (112 + 1)` (log-linear correction, Hautus 1995)
  - `dPrime = Φ⁻¹(H) − Φ⁻¹(F)`
- **Probes:** each result has `{ afterIndex, answer, preProbeCv }`.
  - `preProbeCv` is the CV of RTs in the last 8 trials up to and including the probe trial that are in the RT set.
  - It is `null` if fewer than 4 of those 8 trials qualify.
- **Behavioural flags** are descriptive only and never invalidate a session:
  - `high_omissions`: `omissionRate > 0.3`
  - `many_anticipations`: anticipations make up more than 10% of presses
  - `regular_timing`: `rtCv < 0.05` (machine-like regularity; only when `rtCv` is not null)
- **`longestSteadyRun`:** the longest run of consecutive correct trials (a go trial pressed without anticipation, or a target withheld), for the session-journey UI.
- The result always includes `scoringVersion`.

## Test cases (Vitest)

**Plan**

- The same seed produces a deep-equal plan; different seeds produce different plans.
- Across 500 seeds: 126 trials, 14 of each digit, no adjacent repeats, font sizes within 0–4.
- Across 500 seeds: 4 probes, all on go trials, gaps within 24–36, last probe ≤ 120.

**Validation**

- A valid submission is accepted.
- Errors are reported for the wrong length, a negative RT, RT > 1150, NaN, the wrong number of probe answers, and an unknown answer.

**Scoring**

- Perfect player (presses every go trial at a constant 400 ms, withholds every target):
  - 0 commissions and 0 omissions;
  - median 400 and CV 0;
  - d′ equals the value computed by hand with the log-linear correction;
  - `longestSteadyRun` = 126.
- "Press everything" player: commissions = 14; d′ ≈ 0.78. It is not ≤ 0, because the log-linear correction with unequal trial counts (14 vs 112) moves "no discrimination" slightly above zero, but it is still far below the perfect player's ≈ 4.45.
- "Never press" player: omissions = 112; the RT stats are `null`; the `high_omissions` flag is set.
- Transition trials are excluded: putting huge RTs only on transition trials does not change the median or CV. The test derives transition indices from this spec, not from the implementation.
- The pre-probe window includes the probe trial itself.
- Anticipations are counted, excluded from the RT set, and raise `many_anticipations` above 10%.
- `regular_timing` is raised for CV < 0.05, not for human-like CV (≈ 0.125), not when CV is null, and changes no other metric.
- Across 500 seeds, none of the first 5 trials is a target.
- Known statistics: a hand-built RT set gives the expected median, sample SD and CV.
- Φ⁻¹ matches reference values: Φ⁻¹(0.5) = 0, Φ⁻¹(0.975) ≈ 1.959964, Φ⁻¹(0.025) ≈ −1.959964.
- `preProbeCv` is `null` when there is too little data and correct otherwise.

## Versioning

Any change to how a session is scored bumps `scoringVersion`, so stored scores can be told apart and recomputed from the raw responses.

## Out of scope

Progress, baselines and insights are in Spec 002 (`specs/002-progress`). Persistence and API are in Spec 003.

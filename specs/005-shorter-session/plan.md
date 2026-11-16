# Plan: Spec 005

## Core (`packages/core`)

- `src/config.ts`: `copiesPerDigit` 9, `probesPerSession` 3, `probeGapMin` 20, `probeGapMax` 26, `lastProbeMaxIndex` 75, `scoringVersion` 3, `similarWithin` 0.12 / 0.03. Plan generation and scoring already read these, so no algorithm changes.
- Tests: plan, score and config tests take their numbers from the spec (Python for d′).

## API (`apps/api`)

- `drizzle/0002_delete_old_sessions.sql`: a custom migration (`drizzle-kit generate --custom`) that deletes sessions whose `trials` array does not have 81 entries.
- Tests: trial and probe counts, the migration on a container with mixed sessions.
- Demo player: unchanged code (it reads the config); its probe answers list is long enough for 3 probes.

## Web (`apps/web`)

- `game/practice.ts`: 12-trial plan.
- `game/Steps.tsx`: two steps.
- `screens/Play.tsx`: the practice-done step goes away; Before you start takes the optional practice summary and shows the line, the tip and Practice again. `PracticeResult.tsx` becomes a small `PracticeSummaryLine` (line + tip) used inside Before you start.
- `screens/Home.tsx`: a welcome card when there are no sessions.
- `results/JourneyRibbon.tsx`: the parts already split by thirds; only the copy ("about 30 seconds") changes.
- `metrics/metrics.ts`: the go-trial count is already derived from the config.
- Tests: practice plan, play flow, Home, Results, end-to-end counts.

## Docs

- Spec 001, 003 and 004 updated to the new numbers and flow; design note §3 and §4.

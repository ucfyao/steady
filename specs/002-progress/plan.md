# Plan — Spec 002

- **Where:** `packages/core/src/progress.ts`, exported from `index.ts`. Constants go in a new `PROGRESS_CONFIG` in `config.ts`, next to `SART_CONFIG`, so they stay in one file without touching `scoringVersion`.
- **Types:** `CheckIn`, `SLEEP_LEVELS`, `STRESS_LEVELS`, `ProgressSession`, `ProgressMetric`, `MetricSummary`, `MetricSet`, `ProgressSummary`, `Group`, `GroupComparison` in `types.ts`.
- **Contract:** `CheckInSchema` in `contracts.ts` (both fields optional, strict level enums).
- **Reuse:** `median` from `stats.ts`. One private helper builds a `MetricSet` from a slice of sessions; one builds a `GroupComparison` from keyed values. No new dependencies.
- **Input order:** the caller passes sessions oldest first. Core does not sort, because it has no timestamps; the API query orders by `completed_at`.
- **Testing:** small hand-built fixtures with round numbers, so the expected medians are obvious from the fixture. Afterwards, a mutation check on each rule (practice exclusion, baseline window, recent window, minimum group size, two-group rule).

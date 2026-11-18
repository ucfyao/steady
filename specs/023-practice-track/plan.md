# Plan: Spec 023

- `apps/web/src/game/TrialCells.tsx` + CSS: a row of cells (pending or an outcome), using the journey's outcome classes (`results/JourneyRibbon.module.css`) so the colours are one definition.
- `apps/web/src/game/Block.tsx`: a `practice` prop renders the track (12 pending cells); `count` writes each cell's outcome straight into the DOM, like the fireflies, so React still commits only at phase changes.
- `apps/web/src/screens/Play.tsx`: pass `practice` to the practice block; keep the practice outcomes (core's `trialOutcome` of each RT) next to the summary.
- `apps/web/src/game/PracticeLine.tsx`: the card (cells, numbers, tip, Practice again).
- Tests: `apps/web/test/practice-track.test.tsx`; existing practice-line assertions follow the card.

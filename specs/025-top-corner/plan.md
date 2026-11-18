# Plan: Spec 025

- `apps/web/src/styles/tokens.css`: `--night-chip`, the pill's fill.
- `apps/web/src/game/Block.module.css`: the HUD starts at Stop's top with Stop's height and centres its items; `.mult` uses `--night-chip`; Stop draws a 28 px circle in `--night-chip` around a smaller "×", muted, full colour on hover; `.plain` sets `--night-chip` to the sunken paper surface.
- Layout only: jsdom has no layout, so the check is a measurement in a real browser (centres and target size), plus the existing Stop tests.

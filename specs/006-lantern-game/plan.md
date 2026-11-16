# Plan: Spec 006

## Core

- `src/points.ts`: `createPointsCounter`, `scorePoints`, `pointsSoFar`, `maxPoints`; `GAME_CONFIG` in `config.ts`.
- `score.ts`: the outcome rule as `trialOutcome`, used by `scoreSession`. The score itself does not change.
- `VARIANTS` / `Variant`; `StartedSession.variant`, `CompletedSession.variant`; `StartSessionSchema.variant` (optional).

## API

- Migration `0003_variant`: `players.variant` (random backfill through a volatile default, then the default dropped) and `sessions.variant` (`calm` for existing rows).
- `POST /api/players` draws the variant; `GET /api/me` returns it; `SessionsService.start` stores the override or the player's variant.
- The demo player is in the `game` variant.

## Web

- `game/Scene.tsx`: the static night scene; `--dawn` blends it.
- `game/Block.tsx`: the lantern (digit on the glass, frost mask, glow), the Ready/Set/Go countdown, and, in the game variant, points, multiplier, fireflies and dawn, all written to the DOM outside React. `TrialRunner.press` now returns the trial and RT of a counted press.
- `game/env.ts`: `variantOverride` from `?variant=` at app load.
- `screens/Play.tsx`: the practice uses `GET /api/me`'s variant (or the override); the real session uses the server's.
- `screens/Results.tsx`: the game block for a game session.

# Plan: Spec 018

- `apps/web/src/Layout.tsx`: the outlet context gains `setOverHero`; a `useOverHero(on)` hook (a layout effect, like `useNightPage`). The header lies on a scene on Home, or while a screen asks for it; never while a notice is shown.
- `apps/web/src/screens/Results.tsx`: the band (`section aria-label="Your sky"`) with `Scene rich`, `--dawn` from `dawnPercent` for game sessions, the conclusion and `GameSummary` (no longer a `Card`); calls `useOverHero(true)` only when a session is shown.
- `apps/web/src/screens/Results.module.css`: the band (full width, washes, night text), the game summary without its card.
- No core or API change.

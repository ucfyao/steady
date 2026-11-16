# Plan: Spec 007

- `apps/web/src/game/dawn.ts`: `dawnPercent` (core's `maxPoints` from the outcomes) and `personalBest`.
- `screens/Home.tsx`: the hero (the `Scene` from Spec 006, an unlit lantern, greeting, lead, start), `GET /api/me` for the variant, the personal best in Last check.
- `progress/WeekDots.tsx`: a lantern per day.
- `screens/Results.tsx`: "New personal best" from the earlier sessions in the loaded history.
- `progress/Skies.tsx` on Progress for a game player.
- No core, API or score changes.

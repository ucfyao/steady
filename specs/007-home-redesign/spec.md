# Spec 007: Home, Results and Progress around the lantern

Status: implemented
Design note: `docs/design-note.md` §3
Depends on: Spec 006
Changes: Spec 004 (Home, Results, Progress)

## Why

Spec 006 made the game itself a night scene, but the screens around it stayed a form: thin rules, one weight of text and nothing to come back for. These screens now carry the same scene and give the game variant something to collect across sessions [P]: a personal best and a gallery of the skies each session reached.

Nothing here changes a measurement, a comparison or a session's score. Personal bests and skies use each session's points, derived from the server's `trialOutcomes` with core's `scorePoints` (points are never stored, Spec 006); the browser only finds the largest and draws them.

## 1. Home (both variants)

- **Hero:** a rounded card at the top with the lantern scene (the same `Scene` as focus mode, static) and an unlit lantern; on it, in light text, "Hi, {name}", the lead "Two minutes. Catch every digit, hold back on 3." and the **Start today's check** button (warm, on the dark card). It is a region named "Today's check".
- **Game variant, after a game session:** the hero's sky is the dawn the last game session reached, with "Last sky: dawn {p}%" under the lead.
- **Last 7 days as lanterns:** each day is a small lantern instead of a dot: lit (warm) when played, an outline when not, today with a dashed outline until it is played. The count above ("2 of 4 days", "goal reached") and the day letters are unchanged.
- **Last check (game variant):** a fourth number, **Personal best**, the largest points of the player's game sessions, with "points" as its unit.
- Everything else (the welcome card for a new player, the starting-point line) is as in Spec 005.

## 2. Results (game variant)

- The "Your game" card says **New personal best** when this session's points are higher than every earlier game session's (by `completedAt`), and there was at least one earlier game session. It never says so for the first game session, for a tie, or for a calm session.

## 3. Progress (game variant)

- **Your skies**, after the summary and before the week: one small sky per game session, newest first, each tinted from night to dawn by the dawn that session reached, with "{p}%" and "{points} pts" under it, linking to its Results. Only the latest 12 are shown, with "Show all N" when there are more. A screen reader gets "Session N: dawn p%, X points" for each.
- The calm variant's Progress has no skies; the rest of Progress is unchanged for both.

## 4. Shared rules (web)

- `sessionPoints(score)`: `scorePoints(trialOutcomes)`.
- `dawnPercent(score)`: `floor(sessionPoints ÷ maxPoints × 100)`, where `maxPoints` is core's, from which trials were 3s (`trialOutcomes`); 0 for a session with no possible points. Used by Results, Home and Progress, so the three always agree.
- `personalBest(sessions)`: the largest points among game sessions, or null without one.

## Test cases

- Home: the hero region with the greeting, lead and start link for a new and a returning player; the week drawn as seven lanterns (played lit, today marked); for a game player, the personal best is the largest points and the hero's `--dawn` is the last game session's dawn with "Last sky: dawn p%"; a calm player has neither.
- Results: "New personal best" when the points beat every earlier game session; not for a tie, not for the first game session, not for a calm session.
- Progress: "Your skies" with one link per game session, newest first, to its Results, each labelled with its dawn and points; at most 12 with "Show all"; none for a calm player.
- `sessionPoints` from hand-worked outcomes; `dawnPercent`: a perfect session is 100, 80 of 160 is 50, 60 of 160 is 37 (rounded down), no points is 0.

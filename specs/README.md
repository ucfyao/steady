# Specs

Every feature starts as a spec, reviewed before any code is written. Each folder follows the [GitHub Spec Kit](https://github.com/github/spec-kit) layout:

- `spec.md`: what and why, with test cases. The source of truth; if the code has to deviate, the spec changes in the same pull request.
- `plan.md`: which files change (from Spec 002 on).
- `tasks.md`: the checklist the work followed, including the real-browser checks.

Later specs often refine earlier ones. The **Changed by** column points to where to read the current behaviour.

## Foundations

| Spec                                        | Title                                           | Status      | Changed by                        |
| ------------------------------------------- | ----------------------------------------------- | ----------- | --------------------------------- |
| [001](001-session-plan-and-scoring/spec.md) | Session plan and scoring (`@steady/core`)       | Implemented |                                   |
| [002](002-progress/spec.md)                 | Progress: baselines and exploratory comparisons | Implemented |                                   |
| [003](003-api/spec.md)                      | API and persistence                             | Implemented |                                   |
| [004](004-web/spec.md)                      | Web app                                         | Implemented | 005, 006, 007, 020, 022, 023, 024 |

## The check

| Spec                                 | Title                                                    | Status      | Changed by              |
| ------------------------------------ | -------------------------------------------------------- | ----------- | ----------------------- |
| [005](005-shorter-session/spec.md)   | A shorter session and a two-step start                   | Implemented |                         |
| [006](006-lantern-game/spec.md)      | The lantern, points, and a calm/game A/B split           | Implemented | 020, 021, 024, 025, 027 |
| [008](008-plain-variant/spec.md)     | A plain control group                                    | Implemented | 027                     |
| [009](009-stop/spec.md)              | Stopping a session                                       | Implemented | 025                     |
| [015](015-night-play/spec.md)        | The whole check in each group's look                     | Implemented | 026 (§2), 027           |
| [020](020-press-hint/spec.md)        | A clearer "Space" hint, moving only before the block     | Implemented |                         |
| [021](021-misted-countdown/spec.md)  | A misted lantern during the countdown                    | Implemented |                         |
| [023](023-practice-track/spec.md)    | Practice shows its trials as it goes, and a result card  | Implemented |                         |
| [024](024-points-explained/spec.md)  | Points that can be read and rules that are written down  | Implemented |                         |
| [025](025-top-corner/spec.md)        | The multiplier and Stop on one line, in one style        | Implemented |                         |
| [026](026-check-backgrounds/spec.md) | One background per group, and light/dark on every screen | Implemented | 027, 028                |
| [027](027-one-group/spec.md)         | One group per player, on every screen                    | Implemented |                         |
| [028](028-one-sky/spec.md)           | One sky behind the page, on every screen of a group      | Implemented |                         |

## Home, Results and Trends

| Spec                               | Title                                         | Status      | Changed by |
| ---------------------------------- | --------------------------------------------- | ----------- | ---------- |
| [007](007-home-redesign/spec.md)   | Home, Results and Progress around the lantern | Implemented |            |
| [010](010-page-layout/spec.md)     | Page layout, panels and consistent states     | Implemented | 028        |
| [014](014-full-bleed-hero/spec.md) | Home's night scene across the whole width     | Implemented | 028        |
| [018](018-results-sky/spec.md)     | Results open on the session's sky             | Implemented | 028        |
| [022](022-trends-name/spec.md)     | The Progress page is called Trends            | Implemented |            |

## Players and appearance

| Spec                                     | Title                                           | Status          | Changed by |
| ---------------------------------------- | ----------------------------------------------- | --------------- | ---------- |
| [011](011-dev-variant-badge/spec.md)     | Seeing and reaching the variants in development | Implemented     | 027        |
| [012](012-theme-toggle/spec.md)          | Choosing light or dark                          | Implemented     | 026        |
| [013](013-player-names/spec.md)          | Player names on the server                      | Implemented     | 016 (§3)   |
| [016](016-shared-player-list/spec.md)    | One shared list of players                      | Implemented     |            |
| [017](017-night-dark/spec.md)            | The dark theme in the night's colours           | Implemented     |            |
| [019](019-theme-button-at-night/spec.md) | No light/dark button in the night look          | Replaced by 026 |            |

## Writing a new spec

1. Copy the layout of a recent spec: a `Status:` line, the design-note section it relates to, what it depends on and what it changes.
2. Give each rule a test case. Values come from the spec or an independent calculation, never from the code under test.
3. When a later spec changes this one, update this one's `Status:` line and the **Changed by** column above.

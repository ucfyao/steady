# Spec 022: The Progress page is called Trends

Status: implemented
Design note: `docs/design-note.md` §1, §6
Depends on: Spec 004
Changes: Spec 004 §10 (the page's name and its links)

## Why

"Progress" promises that the player is getting better. The page often shows the opposite or nothing at all: most changes read "Similar", practice effects inflate early gains (§8), and a check is most useful on a bad day (§3). Steady avoids claims it cannot back (§2, the FTC and Lumosity). The page compares recent sessions with where the player started, over time; it is not a log either, so "History" does not fit. "Trends" is neutral: a trend can rise, stay flat or fall (2026-11-18).

## 1. The name [P]

Every word a player sees changes; nothing else does:

| Where                                 | Was                                                                 | Now                                                              |
| ------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Header link                           | Progress                                                            | Trends                                                           |
| Page title (screen readers, Spec 010) | Progress                                                            | Trends                                                           |
| Loading                               | Loading your progress…                                              | Loading your trends…                                             |
| Load error                            | Could not load your progress                                        | Could not load your trends                                       |
| No sessions                           | No sessions yet. Your progress appears here after your first check. | No sessions yet. Your trends appear here after your first check. |
| Results and Not found                 | See your progress                                                   | See your trends                                                  |
| Manage players                        | … to see their sessions and progress.                               | … to see their sessions and trends.                              |

- **Unchanged:** the route `/progress` (bookmarks keep working), the API (`GET /api/progress`), core's names (`progress.ts`, `ProgressSummary`), the code's component and file names, and every sentence on the page.
- The design note and README name the page Trends.

## Test cases

- The header link reads Trends and opens `/progress`; no "Progress" link.
- The page's level-1 heading is Trends; loading and error read as above.
- Results and Not found link "See your trends" to `/progress`.
- No visible "progress" (any case) on Home, Results, Trends or Manage players for a demo player.

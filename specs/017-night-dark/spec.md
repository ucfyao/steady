# Spec 017: The dark theme in the night's colours

Status: implemented
Design note: `docs/design-note.md` §3
Depends on: Spec 012, Spec 014, Spec 015
Changes: Spec 012 §2 (the dark set's values)

## Why

A look across every screen in the dark theme (2026-11-18, 1280 px) found two different darks side by side:

- the night scene is a deep blue (`--night-bg #1b2340`): Home's hero, the Results game panel, the skies on Progress, the night look of the check (Spec 015);
- the dark set of the paper is a warm brown-black (`--color-bg #1d1b18`, `--color-surface #26231f`).

So on Home the blue hero ends in a brown page, and on Progress and Results blue skies and panels sit in brown cards. In the light theme the paper and the night are clearly two things and read well together; in the dark theme the two darks are close enough to look like a mistake.

Nothing here changes a measurement, a comparison or a score, and no group sees more of the scene than before.

## 1. The dark set [P]

- The dark set's **neutrals move to the night's blue**: the page, the content surface, the sunken surface, the marks, the dividers and outlines, the muted text, and the soft tints behind accent and danger text. The values are in `tokens.css`; the surface sits a little below `--night-bg`, so Home's hero runs into the page below it without a step in hue.
- **The accents stay sage** (primary button, selected chips, links, focus ring, chart lines) and the text colour stays `--night-text`. The lantern's warm yellow remains the night look's own accent (Spec 015), so plain's check in the dark theme is blue paper with sage controls: no scene, no lantern.
- Every text colour is at least 4.5:1 on the surface, the page, the sunken surface and its tint (WCAG AA). Measured:

  | Text                | On                                          | Ratio           |
  | ------------------- | ------------------------------------------- | --------------- |
  | text `#ece6da`      | surface `#1b2135`                           | 12.8            |
  | muted `#a9a7b6`     | surface / sunken `#222941` / mark `#2d3450` | 6.8 / 6.1 / 5.2 |
  | accent `#9cbba0`    | surface / accent tint `#233631`             | 7.6 / 6.1       |
  | link `#a9c6ad`      | surface                                     | 8.6             |
  | danger `#e8907f`    | surface / danger tint `#43283a`             | 6.6 / 5.4       |
  | on-accent `#141a2b` | accent                                      | 8.3             |

- **Unchanged:** the light set, the night look (`[data-night]`), the scene, and how the theme is chosen (Spec 012).

## 2. Plain's check in the dark theme

Plain's focus screen (Spec 008) is drawn on the surface, so in the dark theme it is now dark blue instead of dark brown. It still has no scene, no lantern and no glow, which is what the plain group controls for (Spec 008 §1). The colour scheme is not recorded with a session (Spec 012 §4), and there is no production data yet, so no comparison is affected.

## Test cases

- Real browser, dark theme, 1280 px and 375 px: Home (hero into the page), Progress (skies), Results of a game player (game panel), Players, the avatar menu, and plain's check (How it works, Before you start, focus mode); light theme unchanged.
- Contrast of the new values measured (table above).

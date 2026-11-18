# Spec 019: One look, the night

Status: implemented
Design note: `docs/design-note.md` §3
Depends on: Spec 015, Spec 017, Spec 018
Replaces: Spec 012 (choosing light or dark)
Changes: Spec 017 (its set is now the only one), Spec 008 §1 (plain's screens are in the night's colours)

## Why

After Specs 017 and 018 the app had two looks, the light paper and the night blue, and a button to choose between them. Two problems remained:

1. **The button contradicts the night look.** Calm and game play the whole check in the night look whatever the choice (Spec 015). On those screens the button showed a moon ("Switch to dark") on a dark page, and a click changed nothing visible until the player left the check. After switching between players of different groups, the button and the page no longer agreed (found 2026-11-18).
2. **Plain's task depended on an unrecorded setting.** Plain's focus screen follows the colour scheme, which is not recorded with a session (Spec 012 §4), so plain sessions mixed two screens that a comparison between the groups could not tell apart.

With one look, both go away, and every screen sits in the same night as Home's hero and the Results sky [P].

## 1. One set of colours

- The app has **one set of colour tokens**: the night blue of Spec 017 (page, surface, text, sage accents), with `color-scheme: dark`. It no longer depends on the system's colour scheme.
- The night look of the check (`[data-night]`, Spec 015) is unchanged: calm and game play it on the scene with the lantern's yellow.
- **Plain** is unchanged in what matters to it as the control (Spec 008 §1): no scene, no lantern, no glow, a bare digit and the `⊗` mask. Its screens, focus mode included, are now on the night-blue surface for every plain player.
- Every text colour stays at least 4.5:1 (the table in Spec 017).

## 2. No choice

- There is **no light/dark button** in the header, and nothing in the app reads or writes a colour scheme. The header is: the brand, Progress, the avatar.
- A choice stored by Spec 012 (`steady.theme.v1`) is ignored; it is not cleared, as it is never read.
- `index.html` has no pre-paint script: there is nothing to apply before the first paint.

## 3. Comparison

Plain sessions before this spec may have been played on the light or the dark surface. There is no production data yet, so no session is relabelled.

## Test cases

- The header has no light/dark button on Home, Progress, Players and the check.
- A stored `steady.theme.v1` (light or dark) sets nothing on `<html>`.
- Real browser: Home, the check (plain and calm), Results, Progress, Players at 375 and 1280 px, with the system in light and in dark: the same colours.

# Spec 015: The whole check in each group's look

Status: implemented; §2 (the night colours around focus mode) replaced by Spec 023, where the content follows the light/dark choice on Home's scene
Design note: `docs/design-note.md` §3
Depends on: Spec 006, Spec 008, Spec 014
Changes: Spec 008 §1 (where the groups differ: the whole check, not only focus mode)

## Why

The screens around focus mode in `/play` ("How it works", the practice result, "Before you start", waiting and error states) are paper for every group. A calm or game player therefore switches between paper and night five times in one check: How it works (paper), practice (night), practice result (paper), Before you start (paper), the session (night), Results (paper). The switches happen right around the measurement.

Making those screens night for everyone would show the scene to the plain group just before its task, weakening it as the control (Spec 008). So each group gets one look for the whole check.

## 1. Where the groups differ [P]

- **The whole check (`/play`) is in the group's look**, from the first screen to the last: every step outside focus mode and focus mode itself.
  - **plain:** paper (with the light/dark theme), as now. Nothing changes for plain.
  - **calm and game:** night, on the same scene as their focus mode.
- The look follows the variant this browser plays: the override from `?variant=` (Spec 006 §5) or the player's group, the same variant practice uses. Until it is known (while the check loads), the screen is paper.
- **Unchanged and the same for every group:** Home (Spec 014), Results, Progress and every other screen. Spec 008 §1's rule now reads: outside the check, every group sees the same screens.
- Words, steps, rules, practice and questions are the same in every look; only colours and the background differ.
- **Comparison:** plain against calm is now the effect of the scene over the whole check (it was over focus mode only). There is no production data yet, so no session is relabelled.

## 2. The night look

- **Background:** the focus-mode scene (Spec 006 §1, `Scene` without `rich`, at night), fixed behind the whole window, so the step into focus mode keeps the same picture.
- **Colours:** a night set of the colour tokens, applied to the page while the check is shown (the header and its menu included):
  - text `--night-text`, muted text a lighter grey-beige; panels, fields and the menu on an opaque dark blue surface with a light border;
  - the primary button, selected chips, links and the focus ring in the lantern's warm yellow, with dark text on it;
  - danger, tints and marks as dark-scheme equivalents on that surface.
  - Every text colour is at least 4.5:1 on the surface and on the scene's darkest and lightest sky (WCAG AA).
- `color-scheme: dark`, so form controls and scroll bars are dark too.
- The light/dark choice (Spec 012) does not change the night look; it still applies on every other screen, and to plain's check.

## Test cases

- A calm player and a game player: on "How it works" and on "Before you start" the page is in the night look with the scene behind it.
- A plain player: no night look and no scene on those screens.
- An override (`?variant=plain` for a calm player): the override decides.
- Leaving the check (to Home): the night look is gone.
- While the check loads: no night look.
- Real browser: every step of a calm practice and session at 375 px and 1440 px, light and dark system theme; contrast of the night tokens measured.

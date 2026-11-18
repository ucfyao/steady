# Spec 019: No light/dark button in the night look

Status: replaced by Spec 023 (the button is always shown)
Design note: `docs/design-note.md` §3
Depends on: Spec 012, Spec 015
Changes: Spec 012 §1 (where the button is)

## Why

Calm and game play the whole check in the night look, whatever the light/dark choice (Spec 015 §2). On those screens the header's light/dark button had no visible effect: on a light choice it showed a moon ("Switch to dark") on a page that was already dark, and a click changed only what the player would see after leaving the check. After switching between players of different groups, the button and the page no longer agreed (found 2026-11-18).

## 1. Where the button is

- The light/dark button (Spec 012) is in the header on every screen outside focus mode, **except while the night look is shown** (Spec 015: calm and game in the check, from the first step to the last).
- When the night look ends (leaving the check, or switching to a plain player), the button is back, showing the choice as before. The choice itself is unchanged: it is kept, and applies everywhere else.
- Plain's check keeps the button: its screens follow the choice (Spec 012 §2).

Nothing else changes: the light and dark sets (Spec 017), the night look and the header's other items.

## Test cases

- Calm and game: no light/dark button on How it works.
- Plain: the button on How it works.
- Leaving a calm check for Home: the button is back.

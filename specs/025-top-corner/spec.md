# Spec 025: The multiplier and Stop on one line, in one style

Status: implemented
Design note: `docs/design-note.md` §3
Depends on: Spec 006, Spec 009
Changes: Spec 006 §2 (where the points and multiplier sit), Spec 009 (how Stop looks)

## Why

In focus mode the game variant's "×1" pill and the Stop "×" sat side by side but did not match (2026-11-18). Measured in a browser: the pill's centre was 41 px from the top (the points' row starts 20 px down) and Stop's 34 px (it starts 12 px down), so Stop sat 7 px higher. The pill had a dark fill and yellow text; Stop was a bare grey glyph at 40% opacity, so the two looked unrelated.

## 1. One line [P]

The points, the multiplier and Stop share one centre line: the points row starts where Stop does (12 px from the top, or the safe area) and is as tall as Stop's 44 px touch target, with its items centred. Stop keeps its place and its 44 px target (Spec 009).

## 2. One style [P]

- Stop's visible part is a 28 px circle (the pill's height) with the pill's fill, and a smaller "×" inside.
- The fill is one token, `--night-chip`, used by both; on the paper look (plain) it is the paper's sunken surface. No colour is written outside `tokens.css`.
- Stop stays quieter than the multiplier, as Spec 009 asks ("findable, but never competing with the digit"): its "×" is the muted text colour, never the lantern yellow; it lights to the full text colour on hover.
- The same in every group: plain draws the same circle in its paper colours (it has no points or multiplier).

## Test cases

- Real browser, game, 375 px and 1280 px: the vertical centres of the points, the multiplier and Stop are equal (within 1 px); Stop's target is still 44 × 44 px.
- Real browser, plain: Stop's circle in the paper colours, light and dark.
- The Stop tests of Spec 009 still pass (button, Escape, over a probe).

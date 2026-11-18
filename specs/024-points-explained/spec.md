# Spec 024: Points that can be read and rules that are written down (game variant)

Status: implemented
Design note: `docs/design-note.md` §3
Depends on: Spec 006
Changes: Spec 006 §2 (what the game variant shows), Spec 004 (How it works)

## Why

Play-testers could not read the "+10" that floats up from the lantern (it was body-size text against the stars), and asked what the "×1" in the corner meant: the points rules were written nowhere a player could see (2026-11-18).

## 1. The award is larger [P]

The "+N" after each award is in the points' face (Fraunces) at the points' size (`--text-2xl`), in the lantern colour, and rises and fades over 0.7 s as before. It appears after the press it rewards, so it cannot change that press's time. It belongs to the game layer, so it changes only the game condition (calm against game measures that layer, Spec 008); there is no production data yet.

## 2. The rules on How it works [P]

In the game variant only, How it works adds one short block under the rule:

> **Points.** 10 for each digit, 30 for each 3 you hold back. In a row they multiply: ×2 from 5, ×3 from 15, ×5 from 30. A slip restarts the streak; the points you have stay.

- The "×2" is drawn as the corner's multiplier pill, so the corner can be recognised.
- Every number comes from core's `GAME_CONFIG`; none is written in the web app.
- Plain and calm have no points, so they show no such block (the groups already differ by the game layer, Spec 006 §5).
- During the block nothing more is added: no tooltip or help, because focus mode has no hover on touch and any pop-up is a distraction.

## Test cases

- Game: How it works shows the points block with 10, 30 and ×2 from 5, ×3 from 15, ×5 from 30 (from this spec, Spec 006 §2).
- Plain and calm: no points block.
- Real browser: the larger award during a game practice; the block on How it works at 375 px and 1280 px.

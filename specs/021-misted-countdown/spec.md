# Spec 021: A misted lantern during the countdown

Status: implemented
Design note: `docs/design-note.md` §3
Depends on: Spec 006, Spec 008
Changes: Spec 006 §1 (the countdown)

## Why

From the first digit on, the lantern's glass is always a digit (250 ms) or frost (900 ms). The countdown was the only time the glass was bare: a blank white lantern for 3 s before practice and before the session, which play-testers found unfinished (2026-11-18).

## 1. The glass during the countdown [P]

- In calm and game, the glass is **misted (the frost of Spec 006) from the start of the countdown**. The first digit clears it, as every digit does, and the trials run unchanged.
- The frost is the state between digits, so nothing new appears and nothing extra disappears at the first digit: the countdown already looks like the block it leads into. It is a texture, not a digit, so the countdown still never looks like a stimulus (Spec 004).
- Not chosen: a flame in the lantern (a new element that must vanish where the first digit appears, at the moment it appears) and the countdown words on the glass (where digits appear).
- **Plain is unchanged:** its countdown keeps the empty paper centre (Spec 008, the control).
- Timing, the countdown's words and dots, and the score are unchanged.

## Test cases

- Calm and game: through the whole countdown the frost is on and the glass shows no digit; at the first digit the frost is off and the digit shows.
- Plain: no frost (unchanged test).
- Real browser: the countdown of a calm and a game practice at 375 px and 1280 px.

# Spec 009: Stopping a session

Status: implemented; Spec 025 draws Stop as a circle on the multiplier's line
Design note: `docs/design-note.md` §5
Depends on: Spec 004, Spec 006, Spec 008
Changes: Spec 004 (focus mode, "Leaving voids the session")

## Why

Focus mode removes the header and all navigation (Spec 004), so once the countdown starts there is no way out on screen. On a desktop the player can switch tabs or press the browser's Back; on a phone in a home-screen app there may be neither, and the player is held for about two minutes. Stopping should be a plain, visible choice.

## 1. The stop control

- A small **×** button in the top-right corner, named **Stop**, from the countdown to the last trial, in practice and in the real session, and over a probe. It is in all three variants (plain, calm, game), so it cannot explain a difference between them.
- It is quiet (40% opacity, full on hover; no fill) so it does not compete with the digit, yet always visible: a touch screen has no hover, and a hidden control would not be found. It sits outside the tap area: on a touch device a tap on it is not a press.
- **Escape** does the same on a keyboard.
- Space never activates it: the block already takes Space for presses.

## 2. What stopping does

- It ends the block at once, with no confirmation: a dialog would interrupt the timing anyway, so a session that was stopped could not be continued.
- Nothing is submitted, as when the page is left (Spec 004).
- The status page is **"Session stopped"** ("You stopped the session, so it was not saved.") or, in practice, **"Practice stopped"** ("You stopped the practice."), with **Play again** and **Back to home** as for a voided session. Play again follows the same rule (a first-time player who stopped the practice starts again at step 1).
- Leaving the page still shows "Session voided" with its own words.

## 3. Tests

- Stop by button and by Escape, in the countdown, during trials and over a probe: the stopped page, nothing submitted, no more frames drawn.
- Practice: "Practice stopped"; Play again for a first-time player goes to step 1.
- A touch on Stop does not record a press; Space does not stop.
- The button is there in every variant.
- Leaving the page still says "Session voided".

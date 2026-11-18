# Spec 023: Practice shows its trials as it goes, and a result card after it

Status: implemented
Design note: `docs/design-note.md` §3
Depends on: Spec 004, Spec 005, Spec 008
Changes: Spec 004 (focus mode during practice), Spec 005 (how the practice went, on Before you start)

## Why

During practice nothing said how far along it was, and after it Before you start showed one small line ("Practice: 1 of 2 3s held back · 10 of 10 digits caught") that read like a footnote. Play-testers wanted to see the practice unfold, and a result that looks like one (2026-11-18). The session journey on Results already shows trials as cells; practice uses the same cells.

## 1. During practice [P]

- **A track of 12 cells**, one per practice trial, at the bottom of the screen above the rule line, in the session journey's cell style (Spec 004): steady press, held back on a 3 (hollow), pressed on a 3, missed (outline), too early. A cell is empty (a faint outline) until its trial's outcome is known, then takes that outcome: at the press, or when the trial's window closes without one.
- The cells come from core's `trialOutcome`, the rule the server scores with, so the practice track and a session's journey mean the same thing. It is not a score and is never sent.
- **Practice only.** The real session still shows no progress of any kind: knowing how far along you are changes how people respond (Spec 004 §6). Practice is not measured and is short, so a track there costs nothing.
- **The same in every group:** one element, no variant input; only the colour tokens of the page's look (paper, dark, night) differ. The cells change instantly, with no movement.

## 2. After practice: the result card [P]

At the top of Before you start, "How the practice went" becomes a card:

- the same 12 cells, filled, with a legend of only the outcomes that happened (as on Results);
- two numbers in the large serif style of Results: **{held back} of {3s}** "3s held back" and **{caught} of {digits}** "Digits caught", plus **{n}** "Too early" when a press came too early;
- the one tip and Practice again, as before.

No response time (practice starts slow, so its times compare with nothing) and no points. Counted in the browser for this screen only, as before (`summarisePractice`); never sent or stored. The words for screen readers stay the one sentence ("Practice: 2 of 2 3s held back · 10 of 10 digits caught").

## Test cases

- Practice: 12 empty cells at the start; after a press on a digit the first cell is a steady press; a held-back 3 becomes held back when its window closes; by the end every cell has an outcome matching the presses.
- The real session has no track.
- The track has the same markup for plain, calm and game.
- Before you start after practice: the card has 12 cells with those outcomes, "2 of 2" 3s held back and "10 of 10" digits caught for a clean practice, and Too early only when there was one.
- Real browser: a practice in plain and game at 375 px and 1280 px, light and dark; the card after it.

# Spec 020: A clearer "Space" hint, moving only before the block

Status: implemented
Design note: `docs/design-note.md` §3
Depends on: Spec 004, Spec 006, Spec 008, Spec 015
Changes: Spec 004 (the rule line in focus mode), Spec 006 §1 (the countdown)

## Why

The key a player presses is named in three places, and only one of them looks like a key:

- How it works: "Press <kbd>Space</kbd> as soon as you see a digit" (a keycap, with a faint border);
- the countdown: "Finger on Space" (plain text);
- the rule line under the digit, in practice and in the session: "Space for every digit except 3" (plain text).

On a touch device the words are "Tap the screen", "Finger on the screen" and "Tap for every digit except 3". Play-testers asked for the key to stand out more (2026-11-18).

## 1. Where it may move [P]

**Only before the first digit: on How it works and on the countdown's "Ready" and "Set". From "Go" to the last trial, in practice and in the session, nothing about the hint moves.**

- The rule line stays on screen, in peripheral view, through the whole block. Any repeating movement there is a sudden change at the edge of view, which draws attention by itself, however small it is. A rhythm out of step with the trials still competes with their 1150 ms rhythm. Steady measures exactly the rhythm of responses (RT variability), so a moving hint could change the measurement.
- The night scene and the paper surface would make the same movement more or less visible, so even identical code could affect the groups differently and blur the plain against calm comparison (Spec 008).
- Practice rehearses the session's screen, so it stays still too.
- The movement stops one second before the first digit ("Go"), so nothing moves when the block begins.

## 2. The key [P]

- **One key style** in all three places: a keycap (surface fill, a border and a 2 px bottom edge of `--color-text-muted`, semibold). The bottom edge is a shadow, so a press changes nothing around the key (the line keeps its height). The border is ≥ 3:1 against the surface and the page in every look (non-text contrast, WCAG 1.4.11):
  - light paper: `#6e695e` on `#f6f2ea` 4.9:1, on `#ece6da` 4.4:1;
  - dark paper: `#a9a7b6` on `#1b2135` 6.8:1, on `#141a2b` 7.3:1;
  - night: `#b8b2c4` on `#232b4c` 6.7:1, on `--night-bg` `#1b2340` 7.5:1.
- **Keyboard:** "Space" is the key. **Touch:** the same shape holds "Tap" (How it works, the rule line) and "the screen" (the countdown), so both devices get the same emphasis. The words are unchanged.
- **The press [P]:** where it may move (§1), the key moves down by 2 px as its bottom edge closes, and springs back (only `transform` and the shadow change), twice, then rests (a 2.4 s cycle). It is a demonstration of the action, not a light: a glow would look like the lantern's "press counted" feedback (Spec 006) and would bring a glow into plain, which has none (Spec 008).
- **The same for every group.** The key is one component with no variant input; only its colours follow the page's tokens (paper, dark or night, as Spec 015 allows). Nothing from the scene or the lantern is used.
- With `prefers-reduced-motion`, the key never moves (the global rule in `tokens.css`); the static keycap remains.
- The key is not a button and has no behaviour: the press still goes to the block as before.

## Test cases

- How it works, keyboard: "Space" is a key that moves; touch: "Tap" is a key that moves.
- Countdown: the key moves on "Ready" and "Set" and is still on "Go"; keyboard shows "Space", touch "the screen".
- Practice and session: the rule line shows the key, still, with the same words as before ("Practice · Space for every digit except 3"; "Tap for every digit except 3" on touch).
- The rule line and the countdown's key have the same markup for plain, calm and game.
- Real browser: 375 px and 1280 px, light and dark, plain and game, on How it works, countdown, practice and session; reduced motion; contrast measured.

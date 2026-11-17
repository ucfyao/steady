# Spec 013: Home's night scene across the whole width

Status: implemented
Design note: `docs/design-note.md` §3
Depends on: Spec 007, Spec 010, Spec 012
Changes: Spec 007 §1 (the hero), Spec 005 (the welcome for a new player)

## Why

A UI/UX review of Home (2026-11-17, desktop 1440 px and phone 390 px) found:

1. **The night scene is boxed in.** It is the product's one memorable picture, but it sits in a rounded card inside a 720 px paper column, with paper above (the header) and below. On a desktop the column floats in empty beige.
2. **The hero's lantern reads as a blank white box**, not as a lantern.
3. **The welcome repeats the hero.** "About two minutes" says again what the hero's lead says.

Nothing here changes a measurement, a comparison or a score. Home is the same for every group (plain, calm and game; Spec 008 §1), so this changes no group's view more than another's. Focus mode is unchanged.

## 1. The hero across the whole width

- The hero ("Today's check") spans **the whole window width**, from the very top of the page, with no rounded corners. It is at least 26 rem high and 72 % of the window height on a screen of 640 px or wider, at least 24 rem below that; the text sits at its bottom.
- Its text, lantern and button stay **on the content column** (`--content-width`, with the page gutter), so they line up with everything below.
- **The header lies on the scene**, transparent, on Home only: the brand, the navigation, the light/dark button and the avatar are in the night colours (light text, light outlines, a light focus ring), over a dark wash at the top of the scene so they stay readable however far the sky got to dawn. The avatar menu that opens from it keeps its usual surface and colours.
- While a notice is shown (Spec 004), the header stays in its usual place and colours above the notice, and the hero starts below them, so nothing overlaps.
- No horizontal scrolling at any width (the page clips, so a scroll bar's width never adds one).

## 2. The lantern

- The hero's lantern is drawn as a **lit paper lantern**: a warm glass (light at the centre, the lantern colour at the edge) with ribs, a dark cap and base, a short cord that fades out upwards before the header, and a soft warm glow. It is decorative (`aria-hidden`).
- It is about 4.5 rem wide on a phone and 6 rem from 640 px, in the top right of the content column, below the header.

## 3. The welcome for a new player

- The welcome stays a region named "What Steady does", but **without a panel**: one sentence, "A short game that shows how steady your attention is today.", then three short points side by side from 640 px (one under the other below), each with a small round mark:
  - "Starts with a 30-second practice"
  - "Compared only with your own results"
  - "Best a few times a week"
- "About two minutes" goes: the hero's lead already says it.

## Test cases

- The header has the over-scene look on Home only; not on Progress, not on Home while a notice is shown.
- The hero region is unchanged in content: greeting, lead, start link, scene; the lantern is hidden from screen readers.
- A new player's welcome: the sentence and the three points in order; no "About two minutes".
- Real browser: 375 px, 768 px and 1440 px, light and dark, a game player with dawn, the avatar menu open over the scene, a notice shown; no horizontal scroll.

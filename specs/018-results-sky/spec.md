# Spec 018: Results open on the session's sky

Status: implemented
Design note: `docs/design-note.md` §3
Depends on: Spec 006, Spec 010, Spec 014, Spec 015, Spec 017
Changes: Spec 006 §4 (where the game summary sits), Spec 014 §1 (the header lies on a scene on Results too)

## Why

A look across every screen (2026-11-18) found, in the light theme:

1. **Leaving the check is a hard switch.** Calm and game play the whole check on the night scene (Spec 015), and the last step lands on an all-paper Results page.
2. **The game summary is a boxed scene again**: a rounded night card inside the paper column, the pattern Spec 014 removed from Home.

Home already has the answer: the scene across the whole width at the top, the header lying on it, paper below. Results takes the same shape.

Nothing here changes a measurement, a comparison or a score. Results is after the measurement, and every group already sees the scene on Home (Spec 014), so showing it on Results to every group does not weaken plain as the control for the scene during the task (Spec 008 §1): outside the check, every group still sees the same screens.

## 1. The sky band

- Once a session is shown, Results opens with a **band of the night scene across the whole window width**, from the very top of the page, with no rounded corners: `Scene` with `rich`, without the lantern. It is about 40 % of the window height, kept between 18 and 24 rem. It is a region named **"Your sky"**.
- **The sky is this session's:** for a game session, `--dawn` is the session's dawn (Spec 006 §4, the same number as in the summary); for calm and plain, the night (no dawn).
- In the band, on the content column and left-aligned like the page below it:
  - the conclusion (the headline), still the first visible line (Spec 010);
  - for a game session, the game summary ("Your game": the new-best mark, points, longest streak and dawn) without a card of its own. Calm and plain have no game summary (Spec 006 §4).
- The band's text is in the night colours, with the same dark washes as Home's hero (behind the header, and one that grows with the dawn), so it stays readable at any dawn.
- **The header lies on the band**, as on Home (Spec 014 §1): transparent, in the night colours. While a notice is shown it keeps its usual place, and the band starts below it.
- While the session loads, when it is not found, or when it cannot be loaded, there is no band and the header is the usual one.
- Below the band, everything is as before: This session, the journey, About this session, the actions.

## 2. Below the band

The page below is the night's blue (Spec 017, the only set since Spec 019), so the band runs into it, as Home's hero does. (Written when there was also a light theme, where it was Home's shape: sky above, paper below.)

## Test cases

- A game session: the "Your sky" region holds the conclusion and the "Your game" summary; the scene's `--dawn` is the session's dawn; the header lies on the band.
- A calm and a plain session: the band with the conclusion, no game summary, `--dawn` 0; the header lies on the band.
- For a session that is not found: no band, the usual header. Leaving Results gives the usual header back.
- While a notice is shown the usual header stays: one rule in the layout for Home and Results, tested on Home (Spec 014).
- Real browser: 375 px and 1440 px, in both colour schemes as they were then, a game session at a high dawn, a calm session; no horizontal scroll.

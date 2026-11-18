# Spec 023: One background per group, and the light/dark choice on every screen

Status: draft
Design note: `docs/design-note.md` §3
Depends on: Spec 012, Spec 014, Spec 015, Spec 017
Changes: Spec 015 §2 (the night look of the screens around focus mode)
Replaces: Spec 019 (no light/dark button in the night look)

## Why

Since Spec 015 a calm or game player sees the whole check in the night look, whatever the light/dark choice. Spec 019 then hid the light/dark button on those screens, because it had no visible effect there. Together they left two problems (found 2026-11-18):

1. **The header changes for no visible reason.** On Home the header has Progress, the light/dark button and the avatar; on "How it works" a calm or game player sees the same header without the button, and a plain player still has it.
2. **The page jumps between looks.** With the light theme, a calm or game player goes from Home (night hero, paper cards) to a page that is night from edge to edge, and back to paper on Results. The light/dark choice decides some screens and not others.

The fix keeps what Spec 015 wanted (each group recognisably in its own world for the whole check, and no scene for the plain control) and gives every screen the same two rules.

## 1. The rules [P]

- **The scene is always night.** Where a group has a scene, it is the same picture everywhere and does not follow the light/dark choice.
- **Everything else follows the light/dark choice** (Spec 012), on every screen and for every group.
- **The header is the same on every screen outside focus mode** (Spec 008): the brand, Progress, the light/dark button and the avatar, for every group.

## 2. The check's background per group

The screens of the check outside focus mode ("How it works", "Before you start" with the practice result, the waiting screens, the start and submit errors, and the voided screen):

| Group | Background                                                                                         | Content                                                         |
| ----- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| plain | the page colour of the chosen theme; no scene                                                      | on the page, as on every other screen                           |
| calm  | Home's scene (`Scene` with `rich`, Spec 014), fixed behind the whole window, at night (`--dawn` 0) | in one panel on the surface of the chosen theme, over the scene |
| game  | the same scene at the dawn of the player's last game session, as on Home (Spec 007 §1)             | the same panel                                                  |

- The panel is the content column of the screen: the step indicator, the text, the examples, the check-in and the buttons sit inside it. It uses the theme's surface, border and radius, so a click on the light/dark button changes it at once.
- The header lies on the scene, as on Home (Spec 014): light text over a dark wash at the top, whatever the theme. Its menu keeps the theme's surface.
- Every text colour inside the panel is at least 4.5:1 on the panel in both themes (the Spec 017 table applies, as the panel is the theme's surface). The header text is at least 4.5:1 on the scene with the wash, at the darkest and the lightest sky.
- **Game's dawn:** the last completed session with the `game` variant, scored by the server (`dawnPercent`), as on Home. With none, the dawn is 0. The check already loads the player's sessions with the group, so both arrive together.
- **Until the group is known** (while the check loads), the background is the plain page colour, as in Spec 015 §1: no scene appears and then disappears.
- The group follows the variant this browser plays, as in Spec 015 §1 (the `?variant=` override, else the player's group).
- **Unchanged:** focus mode (practice and the session) in each group's look, with no header (Specs 006, 008, 015); Home, Results, Progress and Players.

## 3. What is removed

- The night colour set on the page (`[data-night]`, Spec 015 §2) is no longer applied to the check's screens: the panel's colours come from the light/dark theme. Focus mode keeps its own drawing.
- Spec 019's rule (no button in the night look) no longer applies: the button is always in the header.

## 4. Comparison

Nothing that a session records changes, and focus mode, where the task runs, looks exactly as before. Plain's task screen still follows the light/dark choice, which a session does not record (Spec 012 §4); this remains a known limitation.

## Test cases

- On "How it works" and on "Before you start", for plain, calm and game: the header has Progress, the light/dark button and the avatar.
- plain: no scene on those screens.
- calm: the scene behind the page, at dawn 0; the content in the panel.
- game: the scene at the dawn of the player's last game session (a player with a game session at 40%: dawn 0.4); with no game session, 0.
- calm, light theme: a click on the button sets the dark theme on `<html>` and the button reads "Switch to light".
- The page does not take the night look (`data-night` is not set) on those screens.
- While the check loads: no scene.
- Switching from a calm player to a plain player on "How it works": the scene goes, the header stays the same; and back.
- Focus mode is unchanged: no header, each group's look.
- Real browser: "How it works" and "Before you start" for the three groups, light and dark, at 375 px and 1280 px.

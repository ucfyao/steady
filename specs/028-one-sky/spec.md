# Spec 028: One sky behind the page, on every screen of a group

Status: implemented
Design note: `docs/design-note.md` §3
Depends on: Spec 010, Spec 014, Spec 018, Spec 026, Spec 027
Changes: Spec 014 §1–§3 (Home's hero), Spec 018 (Results' sky), Spec 010 (a panel has a fill and a shadow on the scene)

## Why

Since Spec 026 there were two ways of drawing the scene (found 2026-11-18):

1. **A band** on Home (Spec 014) and Results (Spec 018): the scene fills a block about two thirds of the window high, and the panels under it sit on the page colour. With the light theme, the page goes from night to paper at a hard horizontal line.
2. **Behind the whole window** on the check's screens (Spec 026): the scene is fixed behind the page and the content sits in a panel on the theme's surface.

The two looks met on every check: Home, then the check, then Results, then Home again. Home also drew the scene for the plain group, which never sees one on the check. Three directions were compared on the running app (a band everywhere, the sky behind the window everywhere, the hills running on as ground); the sky behind the window was chosen.

## 1. The rule [P]

- **calm and game:** on Home, the check outside focus mode and Results, the scene is fixed behind the whole window, as on the check (Spec 026). It does not scroll; the hills stay at the bottom of the window. Everything else on the page sits on the theme's surface.
- **plain:** no scene on any screen. The page colour of the chosen theme, as on every other screen.
- **Trends, Players and the status pages** are unchanged: no scene.
- **The header** lies on the scene in the night colours whenever there is one, and stays in the flow of the page (Spec 026). It is no longer laid over a band (Spec 014, Spec 018), so a notice no longer changes it.
- The group is the player's group (Spec 027). On Home it is known with the player list, so the scene is there from the first paint; no screen shows a scene and then removes it.

## 2. Home

- **calm and game:** the lantern, the greeting, the lead, game's last sky and the button sit on the scene in the first window, as before, in the night colours, with the soft dark wash behind the text. The wash fades out inside the block, so it has no visible edge.
- **game's dawn:** the last game session's sky, as before (Spec 007 §1). Until the history arrives the scene is at night (dawn 0).
- **plain:** no scene and **no lantern**. The greeting, the lead and the button sit on the page in the theme's colours, with the theme's primary button.
- **Under the greeting, on the scene:** "Last 7 days", "Last check", the line about the starting point and the welcome for a new player each sit on the theme's surface, with its border and radius. The welcome and the starting-point line get a panel only on the scene; for plain they stay as before (Spec 014 §3).

## 3. Results

- **calm and game:** the conclusion and game's summary sit on the scene at the top, in the night colours, as before. The scene is at the session's own dawn (game) or at night (calm), as in Spec 018.
- **plain:** no scene. The conclusion is a headline on the page in the theme's colours.
- The panels under it sit on the theme's surface. On the scene, the secondary button ("See your trends") takes the night colours of the header, so it stays readable on the sky.

## 4. Panels on the scene

- A panel (`Card`) on a page with a scene has the theme's surface as its fill and a soft shadow, so it stands out from the sky in both themes. Elsewhere it stays as in Spec 010 (a border, no fill, no shadow).
- The check's panel (Spec 026) gets the same shadow.
- Contrast is unchanged: inside a panel the Spec 017 table applies (theme text on the theme's surface); the night text on the scene keeps the dark wash of Spec 014 and Spec 018.

## 5. Comparison

Nothing that a session records changes, and focus mode is unchanged. plain's Home no longer shows the scene, so the control group sees no scene anywhere, which makes the comparison between groups cleaner.

## Test cases

- Home, calm: the scene behind the page at dawn 0, the lantern, the header in the scene's colours.
- Home, game: the scene at the dawn of the last game session; dawn 0 with none.
- Home, plain: no scene and no lantern; the greeting and the button are there.
- Home, calm: the scene is there before the history arrives.
- Home, calm, with a notice: the header still lies on the scene.
- Results: a game session on the scene at its dawn; a calm session at dawn 0; a plain session with no scene; the conclusion is there in every case.
- Results: no scene when the session is not found, and none after leaving for Trends.
- The check (Spec 026) keeps its tests, with the scene now shared with Home and Results.
- A panel on a page with a scene has the surface fill; without one it has none (`data-scene` on the layout).
- Real browser: Home and Results for plain, calm and game, light and dark, at 375 px, 1280 px and 2000 px.

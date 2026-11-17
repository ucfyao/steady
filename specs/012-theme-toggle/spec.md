# Spec 012: Choosing light or dark

Status: implemented
Design note: `docs/design-note.md` §3
Depends on: Spec 004, Spec 008, Spec 010
Changes: Spec 004 (the app follows the system colour scheme only; the avatar menu)

## Why

The app has a full dark set of tokens, but it follows only the system's colour scheme (`prefers-color-scheme`). Someone who keeps the system light but plays in the evening, or the other way round, cannot change it, and checking the dark look means changing the whole system's appearance. A choice inside the app fixes both [P].

## 1. The choice

- In the avatar menu, after Manage players and a separator, a group named **Appearance** with three choices: **Match system** (the default), **Light** and **Dark**. They are radio items (`menuitemradio`); the current one is checked. The keyboard behaviour of the menu (arrows, Home, End, Escape, Tab) covers them like the other items.
- Choosing one applies it at once, closes the menu and returns focus to the avatar, like switching player.
- **Match system** follows the system scheme as now, including a change of the system scheme while the app is open.
- The choice belongs to **this browser**, not to a player: it is kept in `localStorage` (`steady.theme.v1`) and is the same for every player here. It never reaches the server.
- If storage cannot be read or written (a private window, blocked site data), the app behaves as **Match system** and the choice lasts until the page is reloaded.

## 2. How it applies

- **Light** and **Dark** set `data-theme="light"` or `data-theme="dark"` on `<html>`; **Match system** removes it.
- `tokens.css` applies the dark set when `<html>` has `data-theme="dark"`, or when the system is dark and `<html>` does not have `data-theme="light"`. The values do not change.
- **No flash:** a small inline script in `index.html` reads the stored choice and sets `data-theme` before the page is drawn, so a reload never shows the other scheme first.
- What is dark in both schemes stays dark: the night scene (Home's hero, the Results game panel, focus mode in calm and game). The **plain** focus screen (Spec 008) is drawn on the paper surface, so it follows the choice, as it follows the system now.

## 3. Tests

- The menu shows the three choices with Match system checked by default; choosing Dark sets `data-theme="dark"`, stores it, checks Dark and returns focus to the avatar; Match system removes the attribute and the stored value.
- The stored choice is applied on start; an unknown stored value is treated as Match system; storage that throws does not break the menu.
- The keyboard order of the menu now ends with the three choices.
- The inline script in `index.html` sets the attribute from storage (tested as the same function the app uses to read the choice, so the two cannot disagree on the key or the values).

## 4. Out of scope

- Recording the colour scheme with each session. The plain variant's focus screen follows it (as it followed the system scheme before this spec), so a later comparison between groups may want it; that needs a contract and API change and its own spec.
- A per-player choice.

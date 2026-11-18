# Spec 012: Choosing light or dark

Status: replaced by Spec 019 (one look, the night): the button, the stored choice and the light set are gone
Design note: `docs/design-note.md` §3
Depends on: Spec 004, Spec 008, Spec 010
Changes: Spec 004 (the app follows the system colour scheme only; the header)

## Why

The app has a full dark set of tokens, but it follows only the system's colour scheme (`prefers-color-scheme`). Someone who keeps the system light but plays in the evening, or the other way round, cannot change it, and checking the dark look means changing the whole system's appearance. A choice inside the app fixes both [P].

## 1. The choice

Revised after the first version: the choice was three items (Match system, Light, Dark) under **Appearance** in the avatar menu. Nobody looks for the colour scheme in the menu for switching players, and it suggested a per-player setting. It is now a button of its own in the header.

- **A round icon button in the header**, between Progress and the avatar, the same size and outline as the avatar (36 px, with a 44 px tap area). It is in the header on every screen outside focus mode, whether or not a player is ready.
- **One click switches** between light and dark. It shows what a click does: a **moon** while the page is light (named **"Switch to dark"**) and a **sun** while it is dark (**"Switch to light"**). The icons are SVG, in the text colour.
- **Until the first click it matches the system**, including a change of the system scheme while the app is open; the icon follows. After a click the choice is kept and the system no longer decides. There is no way back to matching the system in the app [P]: two states are enough for one button, and clearing site data restores it.
- The choice belongs to **this browser**, not to a player: it is kept in `localStorage` (`steady.theme.v1`, `light` or `dark`) and is the same for every player here. It never reaches the server.
- If storage cannot be read or written (a private window, blocked site data), the page still switches, and the choice lasts until the page is reloaded.

## 2. How it applies

- **Light** and **Dark** set `data-theme="light"` or `data-theme="dark"` on `<html>`; **Match system** removes it.
- `tokens.css` applies the dark set when `<html>` has `data-theme="dark"`, or when the system is dark and `<html>` does not have `data-theme="light"`. The values do not change.
- **No flash:** a small inline script in `index.html` reads the stored choice and sets `data-theme` before the page is drawn, so a reload never shows the other scheme first.
- What is dark in both schemes stays dark: the night scene (Home's hero, the Results game panel, focus mode in calm and game). The **plain** focus screen (Spec 008) is drawn on the paper surface, so it follows the choice, as it follows the system now.

## 3. Tests

- The header has the button; with nothing stored it follows the system: "Switch to dark" on a light system, "Switch to light" on a dark one, and it changes when the system does.
- A click on a light page sets `data-theme="dark"`, stores `dark` and renames the button "Switch to light"; a second click sets and stores `light`. A stored choice is used on start, whatever the system.
- An unknown stored value is treated as no choice; storage that throws does not break the button.
- The avatar menu no longer has an Appearance group.
- The inline script in `index.html` sets the attribute from storage (tested as the same function the app uses to read the choice, so the two cannot disagree on the key or the values).

## 4. Out of scope

- Recording the colour scheme with each session. The plain variant's focus screen follows it (as it followed the system scheme before this spec), so a later comparison between groups may want it; that needs a contract and API change and its own spec.
- A per-player choice.

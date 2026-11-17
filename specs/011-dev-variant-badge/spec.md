# Spec 011: A development badge for the variants

Status: implemented
Depends on: Spec 006 §5, Spec 008
Changes: nothing a player sees

## Why

There are three variants (plain, calm, game; Spec 008). A player's group is drawn by the server and never shown, and the play-test override (`?variant=`) is invisible once the page has loaded. During development and play-tests it is hard to tell which version you are looking at, or how to reach the others, without the browser console.

## 1. The badge

- Shown **only in development** (`pnpm dev`, Vite's `import.meta.env.DEV`). A production build neither renders nor contains it.
- A small fixed panel in the bottom-left corner, named "Dev: version", on every screen except focus mode (it never shows during the countdown, trials or probes).
- It says:
  - **Group:** the active player's own variant, from `GET /api/me` (Spec 006 §5). This decides Home, Results and Progress.
  - **Playing:** the variant this browser plays: the override from `?variant=` when the app was opened, marked "(override)", or the group otherwise.
- **Links to every variant:** "Play as" plain, calm and game, each opening `/play?variant=…`, and **Own group** (`/play`, no override) while an override is on. They are full page loads, because the override is read once when the app opens (Spec 006 §5). The variant being played is marked as current.
- It belongs to the active player: switching player shows the new player's group.
- Nothing is stored and nothing new is sent: it reads `GET /api/me`, which the app already calls.

## 2. Tests

- Without the development flag there is no badge.
- With it: the group from the API, "Playing" equal to the group, and the three links with their addresses; with an override: "Playing" is the override, its link is current, and "Own group" opens `/play`.
- Hidden in focus mode.
- A player switch shows the new player's group.

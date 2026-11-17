# Spec 016: One shared list of players

Status: implemented
Depends on: Spec 003, Spec 004, Spec 013
Changes: Spec 003 (players), Spec 004 (local profiles, player menu, Manage players, import link), Spec 013 §3, design note §7

## Why

Steady is a test project whose deployments we control. Everyone using it should see every player and pick any of them; picking a player shows that player's sessions and progress. Until now a browser only knew the players whose tokens it had created or imported, so players made elsewhere, or deleted elsewhere, did not match what the server held.

The token stays the way a request says who it is for: every player route still takes the player from `Authorization: Bearer <token>`, and every session query is still scoped to that player. What changes is that the server also keeps each token and hands the list out, so the browser no longer keeps its own list.

## 1. Data and API

- `players.token` (migration `0005`): the token in plain text, next to `token_hash`, which the guard still uses to find the player. Players created before this change have no stored token; they are not listed (old data is not carried over; `pnpm bootstrap` / `pnpm seed:demo` refresh a local setup).
- `GET /api/players` (public): every player with a stored token, oldest first: `{ id, name, variant, token, completedSessions, createdAt }`.
- Unchanged: `POST /api/players { name, variant? }` → `{ token }`; `GET`, `PATCH` and `DELETE /api/me` with the player's token; sessions and progress with the player's token.
- **Accepted trade-off [P]:** anyone who can reach the API can read every token and act as any player. This is deliberate for this project. Closing it later means only that `GET /api/players` stops returning tokens (or is protected); nothing else changes.

## 2. Web

- On load the app reads `GET /api/players`. That list is the player menu and the Manage players page, for everyone.
- The browser remembers only **which player is selected** (`steady.activePlayer.v1`, the player's id). With nothing selected, or a selected player that no longer exists, the first player is selected. With no players at all, one is created ("Player 1").
- Selecting a player in the avatar menu makes every request use that player's token; screens are remounted per player, as before.
- **Add a player**, **Rename** and **Delete** on Manage players act on the server with that player's token, then the list is read again. Deleting the selected player selects the first remaining one.
- A request that comes back `401` (the selected player was deleted elsewhere) reads the list again and says "That player no longer exists."
- The import link (`/import#token=…`) is removed: every player is already in the list.
- Manage players says that everyone using Steady sees every player here, and that choosing one in the avatar menu shows their sessions.

## 3. Tests

- API: the list holds every player with a token (new ones included), oldest first, with name, group, token and completed sessions; a listed token works on `/api/me`; deleted players leave the list; players without a stored token are not listed; migration 0005 adds a nullable column.
- Web: the menu and Manage players show the server's list; the selection is remembered across reloads; a missing selection falls back to the first player; an empty list creates "Player 1"; add, rename and delete go through the API and re-read the list; a `401` re-reads the list with a notice; screens use the selected player's token.

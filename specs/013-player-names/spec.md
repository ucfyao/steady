# Spec 013: Player names on the server

Status: implemented; §3's browser cache and import link replaced by Spec 016 (the list of players is on the server)
Depends on: Spec 003, Spec 004, Spec 011
Changes: Spec 003 (players), Spec 004 (local profiles, Manage players, import link), design note §7

## Why

Spec 004 kept a player's name only in the browser that created it. The same player opened in another browser (an import link, a second device, the demo players) then had no name, or whatever name that link carried, and a rename on one device never reached another. The name belongs to the player, so it is stored with the player, and every create, read, rename and delete goes through the API.

## 1. Data

- `players.name`: text, required. A name is trimmed, 1 to 30 characters, and need not be unique (`PlayerNameSchema` in core, used by the API and the web app).
- Players created before this change get the name "Player" from the migration. Old data is not otherwise carried over: a local setup is refreshed by `pnpm bootstrap` / `pnpm seed:demo`.

## 2. API

| Action | Route               | Body                                             | Response                                     |
| ------ | ------------------- | ------------------------------------------------ | -------------------------------------------- |
| Create | `POST /api/players` | `{ name, variant? }` (`variant` per Spec 011 §3) | `201 { token }`                              |
| Read   | `GET /api/me`       | —                                                | `200 { name, variant }`                      |
| Rename | `PATCH /api/me`     | `{ name }`                                       | `200 { name, variant }`                      |
| Delete | `DELETE /api/me`    | —                                                | `204` (name and sessions go with the player) |

- The bodies are strict: an unknown field, a missing or blank name, or one longer than 30 characters is a `400`.
- As every player route, `GET` and `PATCH /api/me` act only on the token's own player.

## 3. Web

- The browser keeps each player's **token**, and the name only as a cache, so the menu can show it before the server answers. The server's name always wins: on load the app reads each player's `GET /api/me` and updates the cache.
- **Add a player** and the first player of a device (`"Player N"` when no name is typed) send the name with `POST /api/players`.
- **Rename** sends `PATCH /api/me` with that player's own token; the row shows "Saving…" and, if it fails, an error and the old name. A name is never changed only locally.
- **Import link:** `/import#token=…`. The name comes from the server; an old link's `name=` is ignored.
- Manage players says each player's name and sessions are stored on the server under their own key, and this browser holds the keys, so clearing its data loses access.
- Demo players are named on the server by the seed (since renamed after their group and kind, Spec 011 §2).

## 4. Tests

- API: create stores the name; `GET /api/me` returns it; `PATCH /api/me` renames and trims, and only the token's own player; blank, too long, missing name and extra fields are `400`; delete removes the player with its name; the seed names the demo players.
- Web: the first player and Add a player send their names; the cache is replaced by the server's name on load; Rename calls the API with that player's token and shows a failure without renaming; import takes the name from the server.

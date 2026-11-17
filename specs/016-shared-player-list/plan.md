# Plan: Spec 016

- core: `PlayerListItem` type.
- API: `players.token` + migration 0005 (nullable); `POST /api/players` stores it; `GET /api/players` (public) lists players with a token and their completed-session counts; seed stores the demo tokens and prints the names only.
- Web: client `listPlayers()`; `players/store.ts` keeps only the selected id; `PlayersProvider` loads the list, selects, creates the first player, and re-reads the list after add, rename, delete and a 401; remove `screens/Import.tsx`, `players/importLink.ts` and the `/import` route; Manage players copy.
- Tests: fake backend keeps a player registry; tests that stored profiles in the browser seed the fake server instead; e2e uses the seeded players from the list.
- Docs: Spec 003, 004, 011, 013, design note §7, README.

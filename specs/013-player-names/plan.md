# Plan: Spec 013

- core `contracts.ts`: `PlayerNameSchema`, `CreatePlayerSchema { name, variant? }`, `UpdateMeSchema { name }`; `Me` type `{ name, variant }`.
- API: `players.name` + migration 0004 (default "Player" for existing rows, then no default); `POST /api/players` stores the name; `GET /api/me` returns it; `PATCH /api/me`. Test helper `newPlayer` sends a name.
- Seed: names Ava, Ben, Cleo; links without `name=`.
- Web: client `createPlayer({ name, variant? })`, `getMe(): Me`, `updateMe({ name })`; provider refreshes every profile's name and group from `GET /api/me` on load (the groups for Spec 011 come from the same calls), `rename` becomes async and calls the API, `importPlayer(token)` reads the name from the server; Players row handles a failed rename; Import ignores `name=`.
- Docs: Spec 003, Spec 004, design note §7, README.

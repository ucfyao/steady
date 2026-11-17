# Spec 011: Seeing and reaching the variants in development

Status: implemented
Depends on: Spec 006 §5, Spec 008
Changes: nothing a player sees

## Why

There are three variants (plain, calm, game; Spec 008). Each player is in one group for good, and every screen follows it: Play, Home, Results and Progress. In development it was hard to tell which group a player is in, and a new player's group is drawn at random, so reaching a given variant meant creating players until one landed there.

A first version put a badge in the bottom-left corner with links to the `?variant=` override. It sat over the page, and the override changes Play only, so Home, Results and Progress still showed the player's own group. Switching **players** gives the whole experience of a variant, so the tools now work through players.

## 1. Each player's group, in development

- Shown **only in development** (`pnpm dev`, Vite's `import.meta.env.DEV`). A production build shows nothing and sends no request for it (an empty hook is all that is left of it).
- The **player menu** shows each player's group after the name ("Ana · plain"), and so does **Manage players**.
- The group is each player's own `GET /api/me`, with that player's token. Nothing new is stored or sent.
- A player whose group cannot be read shows no group.
- The bottom-left badge is gone. The `?variant=` override (Spec 006 §5) stays for quick play-tests, without anything on screen.

## 2. One demo player per group

- `pnpm seed:demo` creates three demo players, **Demo plain**, **Demo calm** and **Demo game**, each with the same two weeks of history, played in its own variant, and prints an import link for each.
- The group is set by the seed script, which writes to the database directly; the API's random assignment is unchanged.
- The links point at `http://localhost:5173` unless `WEB_URL` says otherwise (for a second dev server on another port).

## 3. Choosing the group of a new player (development only)

- In development, **Add a player** has a **Group** choice: **Random** (the default, as in production), plain, calm or game. Choosing one creates the player in that group, to try a new player's first visit in a given variant.
- `POST /api/players` takes an optional `{ "variant": … }`; without it the group is drawn at random, as before (Spec 006 §5). The app sends one only from this development choice, so players in production are still assigned at random.
- The API does not restrict it further. A client that crafts its own requests could already choose what it plays with `?variant=` (Spec 006 §5), so a separate switch for this would add configuration without closing anything.
- An existing player's group cannot be changed, here or anywhere: a player's sessions, starting point and comparisons all come from one variant. To try another variant, add another player.

## 4. Tests

- Web: without the development flag no group is shown; with it, the menu and Manage players show each player's own group, and a player whose group cannot be read shows none.
- API: a demo player seeded in a variant has that group (`GET /api/me`) and its sessions are recorded in it.
- API: a chosen variant is stored; an unknown variant or an extra field is a 400; no body is still a random group.
- Web: the Group choice shows only with the development flag; Random sends no variant, a chosen group is sent and then shown in the menu.

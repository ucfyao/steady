# Architecture

How Steady is put together, and why. For the product and the research behind it, see the [design note](design-note.md); for hosting, see [deployment](deployment.md).

```
apps/web  (React)  ──/api──>  apps/api  (NestJS)  ──>  PostgreSQL 17
     │                             │
     └──────── @steady/core ───────┘
        session plan, validation, scoring, progress, Zod contracts
```

## Packages

| Package        | Path            | Responsibility                                                                                                                |
| -------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `@steady/core` | `packages/core` | Pure domain logic and the API contracts (Zod). No framework, I/O or clock. Every tunable rule is in `src/config.ts`           |
| `@steady/api`  | `apps/api`      | Players and sessions, validation against the stored trials, scoring through core, progress. The only caller of `scoreSession` |
| `@steady/web`  | `apps/web`      | Plays a session, draws what the server scored. Talks to the API only through `src/api/client.ts`                              |

## Data model

Two tables, defined in `apps/api/src/db/schema.ts`. Migrations are generated with `pnpm --filter @steady/api db:generate` and committed in `apps/api/drizzle/`.

**`players`**

| Column       | Notes                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| `id`         | UUID                                                                                                    |
| `token_hash` | SHA-256 of the player's token, unique. Every request is resolved through it                             |
| `token`      | The token in plain text, so `GET /players` can list it (Spec 016). Null for players created before that |
| `name`       | 1 to 30 characters (Spec 013)                                                                           |
| `variant`    | `plain`, `calm` or `game`, drawn at random on creation and fixed (Specs 006, 008)                       |
| `created_at` |                                                                                                         |

**`sessions`** (one row per session; `player_id` cascades on delete; indexed on `(player_id, completed_at)`)

| Column                       | Notes                                                            |
| ---------------------------- | ---------------------------------------------------------------- |
| `seed`                       | Chosen by the server, never sent to the browser                  |
| `trials`, `probe_after`      | JSONB: the exact trials shown, so scoring never regenerates them |
| `check_in`                   | JSONB, optional sleep and stress answers                         |
| `device`                     | `keyboard` or `touch`; one input method per session              |
| `variant`                    | What the session showed                                          |
| `started_at`, `completed_at` | `completed_at` is null while the session is open                 |
| `submission`, `score`        | JSONB: the raw presses and the score computed from them          |
| `scoring_version`            | Which rules produced `score`, so history can be re-scored        |

## API

All routes are under `/api`. Every route needs `Authorization: Bearer <token>` unless marked public.

| Route                       | What it does                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `POST /players` (public)    | Creates a player with a name; returns the token. Rate-limited to 10 a minute                         |
| `GET /players` (public)     | Every player with their token and number of completed sessions (Spec 016)                            |
| `GET /me`                   | The current player's name and variant                                                                |
| `PATCH /me`                 | Renames the player. The variant never changes                                                        |
| `DELETE /me`                | Deletes the player and all their sessions                                                            |
| `POST /sessions`            | Starts a session: the server picks the seed, stores the exact trials and returns them                |
| `POST /sessions/:id/submit` | Validates the raw presses against the stored trials and the server's clock, scores them, stores both |
| `GET /sessions`             | The player's completed sessions with their scores                                                    |
| `GET /progress`             | Starting point, recent performance and the exploratory comparisons, computed by core                 |
| `GET /health` (public)      | Database health                                                                                      |

Submitting a session returns:

- `400` if the presses do not match the stored trials;
- `422` if the timing is implausible (faster than the trials could have run) or the session is older than 30 minutes;
- `409` for a second, different submission; an identical retry returns the stored result;
- `404` for another player's session, the same as a missing one.

## Technical decisions

Each decision with what it costs.

### Domain and trust

- **Scoring lives in a framework-free package.** `@steady/core` depends only on Zod and is tested in isolation. The API is its only caller; the client never computes a score.
- **API contracts are Zod schemas in core,** so the API and the web client validate and type requests from one source.
- **The server owns time and scoring.** The seed is never returned, the exact trials are stored and scored, and the final write is conditional (`completed_at IS NULL`), so two concurrent submits cannot both win.
- **Every tunable rule is in one file** (`packages/core/src/config.ts`), marked `[R]` when it comes from research and `[P]` when it is a product decision. A change to how scores are computed bumps `scoringVersion`.
- **Behaviour is flagged, never rejected.** Only technical integrity problems reject a session; many omissions, anticipations or machine-like timing are flagged and the session stays in the trends. The server never labels a session as cheating.
- **One session, one row.** Trials, the raw submission and the score are JSONB, which keeps writes atomic and keeps the raw presses for re-scoring. Cost: no trial-level SQL queries, which nothing needs yet.
- **The results page only draws what the server scored.** `scoreSession` returns an outcome per trial, and the session ribbon and the game points are derived from those outcomes, so each rule exists once. Points are never stored.
- **The client computes only two things, both from server scores:** the weekly target, because "4 of the last 7 days" depends on the device's calendar and time zone; and, on Results for sessions 3 to 6 (before the starting point exists), the median of the earlier sessions. Both use core's constants and functions.

### Players and security

- **Deny by default.** `PlayerGuard` is global, so a new route needs a token unless it is marked `@Public()`.
- **Players by token, one shared list.** A player is a random 256-bit token, looked up by its SHA-256 hash, and the player id always comes from the token. Every session query filters on `player_id`. For this demo, every player is listed for everyone and anyone can pick any of them (Spec 016); the browser remembers only which player is selected. Making the list private again means only that `GET /players` stops returning tokens. Cost: no accounts and no recovery.
- **The app refuses to start on bad config,** with a message naming the variable.
- **Request logs redact the `Authorization` header;** a test reads the log and checks the token never appears.

### Timing

- **The trial clock is plain TypeScript, driven by frame timestamps.** `TrialRunner` takes `requestAnimationFrame` and `event.timeStamp` values and decides onsets, windows and probes, so timing is unit-tested with synthetic times. The digit is written straight into the DOM inside the frame callback, not through React state, so it is on screen in the frame whose timestamp becomes its onset. In a headless-browser run where a script pressed 400 ms after each digit appeared, the recorded RTs were 400.3 to 404.9 ms (median 401.3).
- **The real session keeps the standard SART timing (250 ms digit, 900 ms mask); only practice is slower.** Practice starts at an 800 ms digit and ends at the real speed. Changing the real timing would make results incomparable with the research and between sessions.

### Build and runtime

- **ESM everywhere; core is built with plain `tsc`.** NestJS 12, Vite and Vitest are all ESM, so one ESM build (with `.d.ts`) serves every consumer. Cost: a build step, which runs on `pnpm install`, `pnpm dev` and `pnpm check`.
- **The API is built with `tsc` and run with `node`,** without the Nest CLI; dev mode is `tsc --watch` next to `node --watch`.
- **Every Nest dependency is named with `@Inject()`,** so the API does not rely on the compiler emitting decorator metadata (tsx and esbuild do not); a test checks every injectable.
- **One test convention: Vitest with `*.test.ts`,** instead of Nest's default Jest. Cost: API tests compile with SWC for decorator metadata.
- **TypeScript is pinned to 5.9,** because typescript-eslint does not support TypeScript 7 yet.
- **Node 26 everywhere:** `.nvmrc` (read by CI), `engines`, `@types/node`, the `volta` field and both Vercel projects name the same version.

### Hosting

- **Two Vercel projects, not Vercel Services.** The web app is static files; the API is the `tsc` build behind one serverless function (`src/serverless.ts`), and the web project forwards `/api` to it, so the browser stays on one origin. Vercel's NestJS preset compiles without decorator metadata, and the API did not start under it. Cost: the web project names the API's domain in `apps/web/vercel.json`, and web previews call the production API.
- **Supabase is used only as PostgreSQL,** through `pg` and Drizzle, so local development (Docker) and production differ only in `DATABASE_URL`. Cost on Vercel: `NODE_OPTIONS=--experimental-require-module`, because `@nestjs/throttler` is CommonJS and `require()`s the ES-module-only Nest 12.

## Testing

- **Core** (Vitest): expected values come from independent calculations (Python `statistics`) or from the spec, never from the implementation.
- **API** (Vitest + Testcontainers): the real Nest app on PostgreSQL 17, with the committed migrations and a fake clock. Mocked repositories would not catch a missing `player_id` filter.
- **Web** (Vitest + Testing Library): the trial runner with synthetic frame and press times; whole sessions on the play screen with a fake frame clock, checked with core's `validateSubmission`.
- **End to end** (Playwright, a separate CI job): a new player practises and plays a full session with real key presses in real time, then sees Results and Trends; a second player on the same device sees none of it; hiding the page voids a session.
- **Mutation checks:** after each change, each new rule is broken on purpose and a test must fail. More than 100 such checks have been run (scoring, progress, player isolation, timing windows, retries, token hashing, rate limits, log redaction, voiding, the screens). The gaps they found are in the [development log](ai-log.md).
- **Real browser checks:** headless Chromium against the real stack, at phone and desktop width, for the game's timing, layout and contrast, which no unit test can see.

CI (`.github/workflows/ci.yml`) runs `pnpm check` and `pnpm build`, then the end-to-end tests, on every pull request.

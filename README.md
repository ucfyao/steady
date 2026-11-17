# Steady

A two-minute daily focus check built on the Sustained Attention to Response Task (SART) with thought probes. Take-home assignment for Walk the Dragon.

> **Status:** complete for the assignment's scope. The scoring and progress core (Specs 001–002), the API (Spec 003) and the web app (Spec 004: player profiles, the game, results and progress) are done, with unit, integration and end-to-end tests in CI.

## Quick start

Requires Node ≥ 24 (`nvm use` reads `.nvmrc`), pnpm 10 (`corepack enable` provides the version pinned in `package.json`) and Docker running. The first `pnpm bootstrap` pulls the `postgres:17-alpine` image, which can take a minute.

```bash
pnpm install        # also builds @steady/core
pnpm bootstrap      # creates .env, starts Postgres 17 (Docker, host port 5433), runs migrations, sets up the demo players
pnpm dev            # web app on http://localhost:5173, API on http://localhost:4000/api
pnpm seed:demo      # refreshes the three demo players (plain, calm, game) and prints their links
pnpm check          # core build, lint, format check, typecheck, all tests (API tests need Docker running)
```

Open http://localhost:5173. The first visit creates a player and starts with a how-to-play screen and a short practice round; a full session takes about two minutes. To try a second player on the same device, open **Manage players** from the avatar menu (top right), add one, then switch to it in the same menu.

To see Progress without playing ten sessions, use the demo players. `pnpm bootstrap` sets them up (and `pnpm seed:demo` refreshes them): three players, one per variant (Ava plain, Ben calm, Cleo game; Specs 011 and 013), named on the server, each with 10 sessions over the past two weeks (session 1 not counted, sessions 2–6 the starting point, some with a check-in), scored by the same `scoreSession` as the API; only the key presses are simulated. Their tokens are fixed, so each always has the same import link, printed by the script, `http://localhost:5173/import#token=…` (set `WEB_URL` for another address); a rerun rebuilds their history as of today instead of adding copies. Open a link while `pnpm dev` is running and the app checks the token with the API, reads the player's name, adds the player, and opens its Progress. Switching between the three in the avatar menu shows each variant on every screen; in development the menu shows each player's group. The token is in the URL hash, so the browser never sends it to the server or a request log, and the app removes it from the address bar at once. Opening the link again switches to the same player rather than adding a copy. The script writes to the database directly: the API accepts only a session that was just played. It runs from source with `tsx` and writes nothing to `apps/api/dist`, so running it while `pnpm dev` is up does not restart the API.

The Docker Compose project is always named `steady`, so every checkout and worktree of the repository shares one Postgres container and one data volume (`steady_pgdata`).

End-to-end tests (real browser, API and database; about 4 minutes, because sessions run in real time):

```bash
pnpm --filter @steady/web exec playwright install chromium   # once
pnpm bootstrap && pnpm e2e
```

(`pnpm setup` is a pnpm built-in, so the setup script is called `bootstrap`.)

## Repository layout

```
apps/api         @steady/api: NestJS 12 + Drizzle + PostgreSQL 17
apps/web         @steady/web: React 19 + Vite 8
packages/core    @steady/core: pure TypeScript session plan, validation, scoring and progress
specs/           one folder per feature (GitHub Spec Kit layout: spec.md, plan.md, tasks.md)
docs/            design note and AI-assisted development log
```

## Data model and API

Two tables (`apps/api/src/db/schema.ts`):

| Table      | Columns                                                                                                                                                                       | Notes                                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `players`  | `id`, `token_hash` (unique), `created_at`                                                                                                                                     | Nothing personal: a player is only the hash of their token                                                                                 |
| `sessions` | `id`, `player_id` → `players` (cascade delete), `seed`, `trials`, `probe_after`, `check_in`, `device`, `started_at`, `completed_at`, `submission`, `score`, `scoring_version` | One row per session; trials, raw submission and score are JSONB. Indexed on `(player_id, completed_at)`. `completed_at` is null while open |

All routes are under `/api`, and all need `Authorization: Bearer <token>` except the two marked public:

| Route                       | What it does                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `POST /players` (public)    | Creates a player; returns the token once                                                                                   |
| `DELETE /me`                | Deletes the player and all their sessions                                                                                  |
| `POST /sessions`            | Starts a session: the server picks the seed, stores the exact trials and returns them (never the seed)                     |
| `POST /sessions/:id/submit` | Validates the responses against the stored trials and the server's clock, scores them with `scoreSession`, and stores both |
| `GET /sessions`             | The player's completed sessions with their scores                                                                          |
| `GET /progress`             | Baseline, recent performance and the exploratory comparisons, all computed by `@steady/core`                               |
| `GET /health` (public)      | Database health                                                                                                            |

A session's life: `POST /sessions` → play in the browser (timing recorded from frame timestamps) → `POST /sessions/:id/submit` → `400` if the responses do not match the trials, `422` if the timing is implausible or the session expired, otherwise scored and stored → Results and Progress read it back. An unsubmitted session expires after 30 minutes and is never scored.

## Deployment

Production runs on Vercel (two projects: `apps/web` static, `apps/api` as one serverless function) with Supabase as PostgreSQL. Pushes to `main` deploy automatically; migrations are a manual step before merging. See [docs/deployment.md](docs/deployment.md) for setup, releasing and troubleshooting.

## Design note

See [docs/design-note.md](docs/design-note.md): which task and which apps I looked at, how it plays and what brings people back, how it is scored and what counts as a good result, how progress is shown, an operator view designed but not built, and the trade-offs.

## Key technical decisions

- **Scoring lives in a framework-free package.** `@steady/core` depends only on Zod and is tested in isolation. The API is its only caller; the client never computes scores.
- **ESM everywhere; `@steady/core` is built with plain `tsc`.** NestJS 12, Vite and Vitest are all ESM, so one ESM build (with `.d.ts`) serves every consumer, and Node runs it without a TypeScript loader. Cost: a build step, which runs automatically on `pnpm install`.
- **API contracts are Zod schemas in `@steady/core`,** so the API and the web client validate and type requests from one source.
- **TypeScript is pinned to 5.9.** typescript-eslint does not support TypeScript 7 (the native compiler) yet.
- **One test convention: Vitest with `*.test.ts`,** instead of NestJS's default Jest. Cost: tests compile with SWC, because esbuild cannot emit the decorator metadata Nest's dependency injection needs.
- **The API is built with plain `tsc` and run with `node`, without the Nest CLI.** `tsc` emits the decorator metadata; dev mode is `tsc --watch` next to `node --watch`.
- **Deny by default.** `PlayerGuard` is global, so a new route needs a token unless it is explicitly marked `@Public()` (only "create player" and health are).
- **Anonymous players, hashed tokens.** A player is a random 256-bit token; the database stores only its SHA-256 hash (a fast hash is fine for a high-entropy token, unlike a password). The player id always comes from the token. Every session query filters on `player_id`, and another player's session returns `404`, the same as a missing one. Cost: a lost token means lost history.
- **The server owns time and scoring.** The seed is chosen by the server and never returned, the exact trials are stored and scored, and a submission is rejected (`422`) if it arrives faster than the trials could have run or after 30 minutes. An identical retry returns the stored result; a different second submission returns `409`. The final write is conditional (`completed_at IS NULL`), so two concurrent submits cannot both win.
- **Players on a device are local profiles.** Each profile is a name plus its token in `localStorage`; the name never leaves the browser. Several people can share a device, and the demo can show two players seeing only their own data, without the server storing anything personal.
- **The trial clock is plain TypeScript, driven by frame timestamps.** `TrialRunner` takes `requestAnimationFrame` and `event.timeStamp` values and decides onsets, windows and probes, so timing is unit-tested with synthetic times. The digit is written straight into the DOM inside the frame callback, not through React state, so it is on screen in the frame whose timestamp becomes its onset. In a headless-browser run where a script pressed 400 ms after each digit appeared, the recorded RTs were 400.3–404.9 ms (median 401.3).
- **One session, one row.** Trials, the raw submission and the score are JSONB columns, which keeps writes atomic; the raw responses are kept so a future `scoringVersion` can re-score history. Trade-off: no trial-level SQL queries, which nothing needs yet.
- **Tests run the real app on a real database.** Integration tests start PostgreSQL 17 with Testcontainers, apply the committed migrations and drive the HTTP stack with a fake clock. CI runs them on every PR. Mocked repositories would not catch a missing `player_id` filter.
- **The app refuses to start on bad config,** with a message naming the variable.
- **Every tunable rule is in one file** (`packages/core/src/config.ts`), marked [R] when it comes from research and [P] when it is a product decision.
- **The real session keeps the standard SART timing (250 ms digit + 900 ms mask); only practice is slower.** A first play-test at full speed was too fast to follow, so practice now starts at an 800 ms digit and ends at the real speed, and the rules are shown as steps before every session. Changing the real timing would make results incomparable with the research and between sessions.
- **The results page only draws what the server scored.** `scoreSession` returns an outcome per trial, and the session journey ribbon is drawn from it, so the "steady" and "anticipation" rules exist once, in core.
- **The client computes only two things, both from server scores:** the weekly target, because "4 of the last 7 days" depends on the device's calendar and time zone; and, on Results for sessions 3–6 (before the baseline exists), the median of the earlier sessions to compare with. Their constants live in core's config, and the median is core's `median`.
- **Exploratory comparisons never overstate.** They are collapsed under "Exploring patterns". A comparison is drawn only once two groups have 10 sessions; until then it says only how many more sessions it needs. Then each group with 10 or more is shown as raw dots with `n` and its median, smaller groups are listed but not drawn, and one sentence ends "a pattern so far, not a cause".

## Testing

- **Core** (Vitest): reference values come from independent calculations (Python `statistics`) or from the spec, never from the implementation.
- **API** (Vitest + Testcontainers): the real Nest app on PostgreSQL 17 with a fake clock.
- **Web** (Vitest + Testing Library): the trial runner with synthetic frame and press times; whole sessions on the play screen with a fake frame clock, checked with core's `validateSubmission`.
- **End-to-end** (Playwright, separate CI job): a new player practises and plays a full session with real key presses in real time, then sees results and progress; a second player on the same device sees none of it; hiding the page voids a session.
- **Mutation checks:** more than 100 deliberate rule breaks (scoring, progress, player isolation, timing windows, retries, token hashing, rate limits, log redaction, results and progress screens, voiding) each made a test fail. Each first round found real gaps, listed in [docs/ai-log.md](docs/ai-log.md).
- **Real browser checks:** headless Chromium against the real stack, at desktop and phone width, for the game's timing (recorded RTs within about 1 ms of the scripted 400 ms), the results page and the progress page.

## Assumptions and limitations

- **Not a clinical tool.** Results are for the player's own trends; all comparisons are within-person and exploratory.
- **Browser timing:** onset is the frame's timestamp, so display can differ by up to one frame (about 17 ms at 60 Hz), and keyboard and touch latency differ by device. The device is stored with each session; results are compared only within a player.
- **Identity:** a player is a token kept in this browser, with a name stored on the server (Spec 013). There are no accounts and no recovery: clearing site data loses the history. Apart from the name the server holds no personal data; real accounts (or employer SSO) would be the next step.
- **Trust:** the server checks that a submission is plausible (length, timing, duration) and flags machine-like timing, but browser input cannot be fully trusted. It never labels a session as cheating.
- **Leaving the page voids a session,** because timing would be interrupted. The open session expires after 30 minutes without being scored.
- **Not built:** offline play, notifications, sharing, leaderboards (on purpose: comparing attention scores with colleagues would discourage honest use), and an operator or employer view (designed in [docs/operator-view.md](docs/operator-view.md), not built: aggregates need real players).

## Time spent

TBD

## AI tools

I used Claude Code throughout, as a pair programmer under a fixed workflow written down in [CLAUDE.md](CLAUDE.md):

- **Spec first:** each feature has a spec (`specs/`) that I reviewed before code; the AI updates the spec in the same PR when code has to deviate.
- **Tests first, with independent expectations:** tests are written and seen failing before the implementation, and expected values come from the spec or a separate calculation, so a wrong rule cannot also produce its own expected value.
- **Deliberate breakage:** after each change, the AI breaks each new rule on purpose and confirms a test fails. This found untested rules in almost every part.
- **Real use:** headless-browser runs against the real stack, and my own play-test, which found that the first game was too fast to learn.
- **Every PR** passes `pnpm check` and CI, and is reviewed and squash-merged by me.

Where the AI was wrong or weak, and how each problem was caught (18 entries: from a test that passed against a stub, to a broken commit workflow, to a delete confirmation that carried over to the next player): [docs/ai-log.md](docs/ai-log.md).

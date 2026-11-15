# Steady

A three-minute daily focus check built on the Sustained Attention to Response Task (SART) with thought probes. Take-home assignment for Walk the Dragon.

> **Status:** work in progress. The scoring and progress core (Specs 001–002) and the API (Spec 003) are done and tested. The web app (Spec 004) has its skeleton, API client and player profiles; the game, results and progress screens come next.

## Quick start

Requires Node ≥ 24 (`.nvmrc`), pnpm 10 and Docker.

```bash
pnpm install        # also builds @steady/core
pnpm bootstrap      # creates .env, starts Postgres 17 (Docker, host port 5433), runs migrations
pnpm dev            # web app on http://localhost:5173, API on http://localhost:4000/api
pnpm check          # lint, format check, typecheck, all tests (API tests need Docker running)
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

## Design note

See [docs/design-note.md](docs/design-note.md): which task I chose and why, how it plays, how it is scored, how progress is shown, and the trade-offs.

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
- **One session, one row.** Trials, the raw submission and the score are JSONB columns, which keeps writes atomic; the raw responses are kept so a future `scoringVersion` can re-score history. Trade-off: no trial-level SQL queries, which nothing needs yet.
- **Tests run the real app on a real database.** Integration tests start PostgreSQL 17 with Testcontainers, apply the committed migrations and drive the HTTP stack with a fake clock. CI runs them on every PR. Mocked repositories would not catch a missing `player_id` filter.
- **The app refuses to start on bad config,** with a message naming the variable.
- **Every tunable rule is in one file** (`packages/core/src/config.ts`), marked [R] when it comes from research and [P] when it is a product decision.

## Testing

`pnpm test` (API tests need Docker). Core reference values come from independent calculations (Python `statistics`), not from the implementation. A mutation check deliberately broke each important rule (53 in total across scoring, progress, player isolation, timing limits, retries, token hashing, rate limits and log redaction) and confirmed a test fails for every one. See [docs/ai-log.md](docs/ai-log.md) for the gaps it found.

## AI tools

I use Claude Code for implementation, reviewing its output against the spec and the tests. Where the AI was wrong, and how each problem was caught: [docs/ai-log.md](docs/ai-log.md).

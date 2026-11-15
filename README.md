# Steady

A three-minute daily focus check built on the Sustained Attention to Response Task (SART) with thought probes. Take-home assignment for Walk the Dragon.

> **Status:** work in progress. The scoring and progress core (Specs 001–002) is done and tested. The API (Spec 003) has its foundation (database, migrations, health, test harness); its endpoints and the web app come next.

## Quick start

Requires Node ≥ 24 (`.nvmrc`), pnpm 10 and Docker.

```bash
pnpm install        # also builds @steady/core
pnpm bootstrap      # creates .env, starts Postgres 17 (Docker, host port 5433), runs migrations
pnpm dev            # API on http://localhost:4000/api (health: /api/health)
pnpm check          # lint, format check, typecheck, all tests (API tests need Docker running)
```

(`pnpm setup` is a pnpm built-in, so the setup script is called `bootstrap`.)

## Repository layout

```
apps/api         @steady/api: NestJS 12 + Drizzle + PostgreSQL 17
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
- **One session, one row.** Trials, the raw submission and the score are JSONB columns, which keeps writes atomic; the raw responses are kept so a future `scoringVersion` can re-score history. Trade-off: no trial-level SQL queries, which nothing needs yet.
- **Tests run the real app on a real database.** Integration tests start PostgreSQL 17 with Testcontainers, apply the committed migrations and drive the HTTP stack. CI runs them on every PR.
- **The app refuses to start on bad config,** with a message naming the variable.
- **Every tunable rule is in one file** (`packages/core/src/config.ts`), marked [R] when it comes from research and [P] when it is a product decision.

## AI tools

I use Claude Code for implementation, reviewing its output against the spec and the tests. Where the AI was wrong, and how each problem was caught: [docs/ai-log.md](docs/ai-log.md).

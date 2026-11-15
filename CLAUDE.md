# CLAUDE.md — instructions for AI coding agents

Steady: a SART-based focus check. pnpm monorepo, TypeScript 5.9, Node 24, ESM everywhere.
Read `docs/design-note.md` for the product, and `specs/` for what is being built.

## Commands

- `pnpm install`: installs dependencies and builds `@steady/core`. Run it first in every new worktree.
- `pnpm bootstrap`: `.env`, Postgres 17 in Docker (host port 5433), migrations
- `pnpm dev`: API on port 4000 (watch mode)
- `pnpm --filter @steady/api db:generate`: after changing `apps/api/src/db/schema.ts`; commit the generated SQL
- `pnpm --filter @steady/core test`: core tests only
- `pnpm --filter @steady/core build`: ESM build with `.d.ts` into `packages/core/dist`. Run it after changing `packages/core/src` so the API sees the change.
- `pnpm check`: lint, format check, typecheck, tests. **Must pass before every commit.** CI runs the same command on every PR. API tests need Docker.

## Layout and boundaries

- `packages/core`: pure domain logic (session plan, validation, scoring, progress) and Zod contracts. No framework, I/O or clock.
- `apps/api` (NestJS) depends on core and never re-implements a scoring rule.
- API: the player id comes only from `@PlayerId()` (set by the global `PlayerGuard`). Every session query filters on `player_id`; another player's data is a `404`. New routes are protected unless marked `@Public()`.
- API tests use the real app (`test/support/app.ts`) on Testcontainers Postgres with `FakeClock`; do not mock the database.
- **Scores are computed only on the server, by `scoreSession`.** A client must never compute or submit a score.
- Every tunable rule lives in `packages/core/src/config.ts`, marked `[R]` (research) or `[P]` (product decision). Do not hard-code thresholds anywhere else.
- A change to how scores are computed must bump `SART_CONFIG.scoringVersion`.

## Workflow

1. **Spec first.** Each feature has `specs/NNN-name/spec.md` (plus `plan.md` and `tasks.md` from Spec 002 on). If the code has to deviate, update the spec in the same PR.
2. **TDD.** Write failing tests first and confirm they fail for the right reason (a stub that throws, not a missing import).
3. **Independent expectations.** Reference values come from an independent calculation (e.g. Python `statistics`) or from the spec, never from the module under test. After a non-trivial change, break the rule on purpose and confirm a test fails.
4. **Behavioural flags are descriptive only.** Only technical integrity problems may reject a session.
5. Log real AI mistakes (yours included) in `docs/ai-log.md`, with how they were caught, in the PR where they were found.

## Conventions

- Workspace packages go in `apps/*` and `packages/*`.
- Vitest with `*.test.ts` everywhere; no Jest.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`), scoped where useful, e.g. `feat(core):`.
- Every change goes through a feature branch and a squash-merged PR; `main` is protected.
- Docs and code are in English.

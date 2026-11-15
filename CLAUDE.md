# CLAUDE.md — instructions for AI coding agents

Steady: a SART-based focus check. pnpm monorepo, TypeScript 5.9, Node 24, ESM everywhere.
Read `docs/design-note.md` for the product.

## Commands

- `pnpm install`: installs dependencies
- `pnpm check`: lint, format check, typecheck, tests. **Must pass before every commit.** CI runs the same command on every PR.

## Conventions

- Workspace packages go in `apps/*` and `packages/*`.
- Vitest with `*.test.ts` everywhere; no Jest.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`), scoped where useful, e.g. `feat(core):`.
- Every change goes through a feature branch and a squash-merged PR; `main` is protected.
- Docs and code are in English.

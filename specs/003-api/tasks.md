# Tasks — Spec 003

Split into two PRs: the foundation (app, database, health, test harness) first, then the endpoints.

**Foundation**

- [x] T1 Write spec, plan and tasks
- [x] T2 Scaffold `apps/api` (package, tsconfig, Vitest + SWC), docker-compose for Postgres 17, `pnpm bootstrap`
- [x] T3 Drizzle schema and first migration
- [x] T4 Failing tests, then config and health (DB module, helmet, logging, body limit); test harness with Testcontainers
- [x] T5 CI runs the API integration tests; `pnpm check`

**Endpoints**

- [x] T6 Core: request schemas and response types
- [x] T7 Clock and Zod pipe; failing tests, then players (create, `DELETE /me`) and the auth guard
- [x] T8 Failing tests, then start / submit / list sessions
- [x] T9 Failing tests, then progress; deleting a player removes their sessions
- [x] T10 Rate limits (throttler)
- [x] T11 Mutation check on isolation, timing and retry rules; README; `pnpm check`

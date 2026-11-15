# Plan — Spec 003

## Stack

- NestJS 12 (ESM-only) on Express 5. Built with plain `tsc` (`experimentalDecorators`, `emitDecoratorMetadata`, `module: NodeNext`) and run with `node`, like core. The Nest CLI is skipped: it adds a second build pipeline for no gain here.
- Dev: `tsc --watch` and `node --watch dist/main.js` together.
- Drizzle ORM 0.45 with `pg`; drizzle-kit for `generate` and `migrate`.
- Vitest with `unplugin-swc`, which emits the decorator metadata that Nest's DI needs (esbuild cannot). `@testcontainers/postgresql` provides the database for tests.

## Structure

```
apps/api/src
  main.ts               bootstrap: loadConfig(process.env) → AppModule.register(config)
  app.module.ts         dynamic module; wires config, db, throttler, logger, feature modules
  config.ts             Zod env schema → AppConfig
  clock.ts              CLOCK token ({ now(): Date }), overridden in tests
  db/schema.ts          Drizzle tables
  db/db.module.ts       DB provider (pool + drizzle), closes the pool on shutdown
  common/zod.pipe.ts    ZodValidationPipe
  auth/                 token helpers, PlayerGuard, @PlayerId() decorator
  players/              POST /players, DELETE /me
  sessions/             start, submit, list
  progress/             GET /progress (calls core's Spec 002 functions)
  health/               GET /health
```

- `AppModule.register(config)` lets tests build the real app with test config (Testcontainers URL, silent logs, high rate limits) without touching `process.env`.
- The guard puts the player id on the request; controllers read it only through `@PlayerId()`.
- Every session query filters on `player_id`, so isolation is enforced in one place per query, not by a later check.

## Core changes

Request schemas (`StartSessionSchema`) and response types (`StartedSession`, `CompletedSession`, `ProgressResponse`) are added to `@steady/core`, so the web client is typed from the same source.

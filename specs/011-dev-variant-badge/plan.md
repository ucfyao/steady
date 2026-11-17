# Plan: Spec 011

- `apps/web/src/dev/devTools.ts`: a context with the development flag, set by `AppRoutes devTools` (`App` passes `import.meta.env.DEV`).
- `apps/web/src/dev/usePlayerGroups.ts`: each profile's `getMe()` through `apiFor(id)`, a new `PlayersContext` function that returns a raw client for that profile's token.
- `PlayerMenu` and `Players` show the group after each name when the flag is on; each use is guarded by `import.meta.env.DEV`, so a production build shows nothing and asks nothing.
- Remove `dev/VariantBadge` and the `devTools` prop on `Layout`.
- `apps/api/src/demo/demo-player.ts`: `seedDemoPlayer(db, now, variant = 'game')`; `seed-demo.ts` seeds one per variant and reads `WEB_URL`.
- Test fake: `getMe` per token.

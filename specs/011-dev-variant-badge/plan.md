# Plan: Spec 011

- `apps/web/src/dev/VariantBadge.tsx` (+ CSS module): reads `getMe()` through `usePlayers`, takes the override as a prop, renders the panel and plain `<a>` links.
- `Layout` takes `devTools?: { override?: Variant }` and renders the badge, keyed by the active player, when set and not in focus mode.
- `AppRoutes` takes `devTools?: boolean` and passes the override it plays with (`playEnv`'s, or the one read at startup, now exported from `game/env.ts`). `App` passes `import.meta.env.DEV`. Tests keep it off unless they test it.
- No core or API change.

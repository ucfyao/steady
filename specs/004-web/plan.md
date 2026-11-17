# Plan — Spec 004

## Stack

- Vite 8, React 19, TypeScript 5.9, React Router 8 (routes: `/`, `/play`, `/results/:id`, `/progress`, `/players`).
- Plain CSS with custom properties for colour tokens (light and dark). No component library: the app has a handful of screens.
- Data: a small typed API client over `fetch`, using core's response types and Zod schemas. No query library; each screen loads what it needs.
- Charts (part 3): Recharts.
- Tests: Vitest + Testing Library on jsdom for logic and components; Playwright for end-to-end against the real API and Postgres.
- Dev: Vite proxies `/api` to `http://localhost:4000`; `pnpm dev` starts the API and the web app together.

## Structure

```
apps/web/src
  main.tsx, App.tsx       router and layout (header with player menu)
  api/client.ts           typed fetch wrapper: bearer token, typed errors
  players/                local profiles (localStorage), active player context
  game/                   pure trial runner + practice sequence (no React, unit-tested)
  screens/                Home, Play (check-in → practice → trials → submit), Results, Progress, YourData
  progress/               weekly target and chart data shaping
  styles.css              tokens and base styles
```

- **The trial runner is plain TypeScript.** It takes frame timestamps and press timestamps and returns what to show and, at the end, the submission. React only renders its state, so timing can be tested with synthetic times instead of real waits.
- **No scoring on the client.** Results come from the submit response; progress comes from `GET /api/progress`. Only the weekly target is computed on the client, because it depends on the player's local calendar (Spec 002, out of scope).

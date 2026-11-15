# Tasks — Spec 004

**Part 1: skeleton, API client, players**

- [x] T1 Write spec, plan and tasks
- [x] T2 Scaffold `apps/web` (Vite, React, Router, Vitest + Testing Library); `/api` dev proxy; `pnpm dev` runs API and web
- [x] T3 Failing tests, then the typed API client
- [x] T4 Failing tests, then local profiles and the active player (create on first visit, switch, add, `401` handling)
- [ ] T5 Layout, Home placeholder and Your data (delete with confirmation); `pnpm check`

**Part 2: the game**

- [ ] T6 Failing tests, then the trial runner (timing, first press, probes, pause/resume)
- [ ] T7 Device detection; practice sequence and feedback
- [ ] T8 Play screen: check-in → practice → countdown → trials → probes → submit; leaving voids the session
- [ ] T9 Manual timing check in a real browser; `pnpm check`

**Part 3: results, progress, end-to-end**

- [ ] T10 Results: journey ribbon, longest steady run, metrics, flags in plain words
- [ ] T11 Failing tests, then the weekly target; Progress screen with charts and comparisons
- [ ] T12 Playwright end-to-end tests in CI; README; `pnpm check`

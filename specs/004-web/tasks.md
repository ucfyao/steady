# Tasks — Spec 004

**Part 1: skeleton, API client, players**

- [x] T1 Write spec, plan and tasks
- [x] T2 Scaffold `apps/web` (Vite, React, Router, Vitest + Testing Library); `/api` dev proxy; `pnpm dev` runs API and web
- [x] T3 Failing tests, then the typed API client
- [x] T4 Failing tests, then local profiles and the active player (create on first visit, switch, add, `401` handling)
- [x] T5 Layout, Home placeholder and Your data (delete with confirmation); `pnpm check`

**Part 2: the game**

- [x] T6 Failing tests, then the trial runner (timing, first press, probes, pause/resume)
- [x] T7 Device detection; practice sequence and feedback
- [x] T8 Play screen: check-in → practice → countdown → trials → probes → submit; leaving voids the session
- [x] T9 Manual timing check in a real browser; `pnpm check`
- [x] T9a After playing it: clear how-to-play steps, and practice that starts slow and ends at the real speed

**Part 3: results, progress, end-to-end**

- [x] T10 Results: per-trial outcomes in core (`scoringVersion` 2); journey ribbon, longest steady run, metrics, flags in plain words (PR 3a)
- [x] T11 Failing tests, then the weekly target; Progress screen with charts and comparisons (PR 3b)
- [x] T12 Playwright end-to-end tests in CI; README; `pnpm check` (PR 3c)

**Part 4: redesign of the game and results**

- [x] T13 Failing tests, then the check-in split: returning players get one screen (Start, Skip, How to play) and go straight to the countdown; first-time players keep the rules and practice
- [x] T14 Focus mode: the layout drops the header while the block runs; full-screen stage, one-line hint, no progress; probe as large buttons with keys 1–3; React commits only at phase changes
- [x] T15 Results in the new style: serif numbers with small labels, ribbon colours from the tokens (a held-back 3 is hollow, a pressed 3 is filled), Back to home and See your progress
- [x] T16 Timing check in a real browser (headless Chromium, real API; a script presses Space 400 ms after each digit appears, "1" at each probe), same machine and script on `main` and on this branch: `main` desktop 112 presses, RT 402.8–410.0 ms, median 406.0; branch desktop 402.5–410.8, median 406.0; branch at 375 px 402.5–410.4, median 406.1. No change; the ~6 ms above 400 is this machine's timer and frame overhead, the same on both. `pnpm check`, `pnpm e2e`

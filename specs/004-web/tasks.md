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

**Part 5: play flow after the UI walkthrough (A1–A9, D1)**

- [x] T17 Failing tests, then the practice result in the browser (3s held back, digits caught, too early; one tip for the most common slip) and the runner's "too soon" practice outcome
- [x] T18 Failing tests, then the new flow: step 1 (how it works) → practice with feedback pills → step 2 (practice result) → step 3 (before you start: check-in and three points, shared with returning players, who land there and can open How to play); step bar only before the session; countdown as a ring with "Finger on Space"
- [x] T19 Failing tests, then the shared status page (Session voided / Practice stopped, Session not found, the new catch-all "Page not found" route) and centred waiting states that respect reduced motion
- [x] T20 Timing check in a real browser, same method as T16 (headless Chromium, real API; a script presses Space 400 ms after each digit appears, "1" at each probe), `main` and this branch on the same machine and API, 112 presses and 4 probes in every run. Desktop, three runs each (the last two alternating): `main` medians 403.8, 406.0, 406.0 (ranges 401.6–407.0, 402.6–410.6, 401.5–411.4); branch 406.5, 406.0, 403.9 (403.2–417.4, 401.5–410.5, 401.7–407.4). 375 px: `main` 403.5–409.7, median 406.2; branch 402.7–410.5, median 406.2. Both sides move between the same two medians from run to run, so no change; the one 417 ms press did not recur. End-to-end tests; `pnpm check`, `pnpm e2e`

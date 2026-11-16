# Spec 005: A shorter session and a two-step start

Status: implemented
Design note: `docs/design-note.md` §3
Changes: Spec 001 (plan constants, test values), Spec 003 (trial counts), Spec 004 (flow, Home for a new player, practice, copy)

## Why

A walkthrough as a new player (2026-11-17) found the first visit too long and too heavy:

- the first session took 4.5–5 minutes: rules, an 18-trial practice, a practice-result screen, the check-in, then 126 trials (2 min 25 s of uninterrupted trials);
- there were five screens and three steps before the first real digit;
- Home opened on "0 of 4 days", "6 more sessions until your starting point" and an empty "Last check", without saying what Steady is for.

## 1. Session length [P]

| Name                           | Before            | After                                     |
| ------------------------------ | ----------------- | ----------------------------------------- |
| copies per digit               | 14                | **9** → 81 trials, 9 targets (11%), 72 go |
| probes per session             | 4                 | **3**                                     |
| probe gap                      | 25–35             | **20–26**                                 |
| last probe at or before index  | 120               | **75**                                    |
| `similarWithin.commissionRate` | 0.1 (one 3 of 14) | **0.12** (one 3 of 9 is 0.111, noise)     |
| `similarWithin.omissionRate`   | 0.02 (2 of 112)   | **0.03** (about 2 of 72)                  |
| scoring version                | 2                 | **3**                                     |

- The trial time is 81 × 1150 ms = 93.15 s; with three probes and the countdown a session takes **about 1 minute 45 seconds**. The per-trial timing (250 ms + 900 ms) is unchanged [R].
- The share of 3s stays at 11%, as in the original. With 9 targets one 3 moves the catch rate by 11 points, so the catch rate is noisier than before; the "similar" band is widened to match, so one 3 is still described as "similar".
- The first probe falls at index 19–25, each later one 20–26 after the previous, the last at or before 75, so each probe has at least 5 trials after it before the end.
- `SUBMIT_CONFIG.minElapsedMs` follows from the config: 81 × 1150 × 0.95 = 88 492.5 → **88 493 ms**.
- **Scoring version 3:** the scoring rules are the same; only the plan is shorter. A version-3 score is never compared with an older one, because older sessions are deleted (below).

## 2. Older sessions are deleted [P]

The 126-trial sessions do not compare with 81-trial ones (a different number of 3s, digits and probes), and there is no data worth keeping yet. Migration `0002` deletes every session whose plan does not have 81 trials, including open ones. Players are kept, so a device's profiles still work; their history starts again. `pnpm seed:demo` builds the demo player with the new length.

## 3. A two-step start

```
First session:  Home ──▶ Step 1: How it works ──▶ Practice ──▶ Step 2: Before you start ──▶ Countdown ──▶ Trials + probes ──▶ …
                                              ▲                    │ Practice again
                                              └────────────────────┘
Returning:      Home ──▶ Before you start (no step bar) ──▶ …
                           └─ How to play ──▶ Step 1 (Try a short practice, or Skip practice ──▶ Step 2)
```

- **Step bar:** "Step N of 2" with a two-part bar: 1 "How it works", 2 "Before you start". The separate practice-result screen is gone.
- **Step 1** is unchanged apart from its footnote: "12 digits · about 30 seconds · not saved".
- **Practice [P]:** 12 trials instead of 18: each go digit once, two more go digits drawn by the seed, and two 3s, with no 3 in the first 3 trials and no digit twice in a row. It starts slow and ends at the real speed, four trials per speed: 800 + 1200 ms, 500 + 1000 ms, then the real 250 + 900 ms. Per-trial feedback is unchanged.
- **Step 2: Before you start.** After a practice, the top of the screen shows how it went in one line, "Practice: 2 of 2 3s held back · 9 of 10 digits caught" (with "· N too early" added when a press came under 100 ms), then the one tip (same wording and rules as Spec 004), and a **Practice again** link. Below that, unchanged: "How are you today?", the Sleep and Stress chips, the three points (the first now reads "About two minutes, at full speed"), **Start**, **Skip** and **How to play**. Without a practice (a returning player), the screen is as before, without the step bar.
- The practice counts are still computed in the browser from the practice's own presses, for this screen only; they are never sent or stored and are not a score.

## 4. Home for a new player

With no completed sessions, Home shows what Steady is before anything about history:

- "Hi, {name}", then the lead "Two minutes. Catch every digit, hold back on 3." (also for returning players);
- a **Welcome** card instead of "Last 7 days", "Last check" and "N more sessions until your starting point": the title "What Steady does", the sentence "A short game that shows how steady your attention is today. Play a few times a week to see your own pattern." and three points: "About two minutes", "Starts with a 30-second practice", "Compared only with your own results";
- the **Start today's check** button.

From the first completed session on, Home is as in Spec 004.

## 5. Other screens

- Results: the journey ribbon's three parts have 27 trials each, "about 30 seconds each".
- "Digits missed" is a count of the 72 digits to press for (derived from the config, not hard-coded).
- Progress: "Needs at least N more sessions" for the pre-probe part divides by the 3 questions per session (already read from the config).

## Test cases

**Core**

- Across 500 seeds: 81 trials, 9 of each digit, no adjacent repeats; 3 probes on go trials, the first at index 19–25 (allowing the one-step move off a target), gaps 19–27, last ≤ 75. The numbers come from this spec, not from the config.
- Scoring, with values worked out in Python (`statistics.NormalDist`): the perfect player has `longestSteadyRun` 81 and d′ = Φ⁻¹(9.5/10) − Φ⁻¹(0.5/73) ≈ 4.1099; "press everything" has 9 commissions and d′ = Φ⁻¹(0.5/10) − Φ⁻¹(0.5/73) ≈ 0.8202; "never press" has 72 omissions.
- `SUBMIT_CONFIG.minElapsedMs` is 88 493; `scoringVersion` is 3.

**API**

- Start returns 81 trials and 3 probes; a submission one response short is rejected with "expected 81 trial responses, got 80"; "press everything" has 9 commissions.
- Migration `0002` deletes sessions whose `trials` do not hold 81 entries and keeps the players and the 81-trial sessions.

**Web**

- Practice plan: 12 trials, 10 go (every go digit at least once) and 2 targets, none in the first 3, no adjacent repeats, four trials per speed.
- Play: a first-time player goes step 1 → practice → step 2 (practice line, tip, check-in) → countdown, with "Step N of 2" and never during the block; Practice again replays the practice and returns to step 2 with the answers kept; a returning player lands on Before you start with no step bar and no practice line.
- Home: with no sessions, the welcome card and none of the history blocks; with a session, the history blocks and no welcome card.
- Results: three parts of 27.
- End-to-end: a full session presses 72 digits, answers 3 probes, and shows 81 ribbon cells.

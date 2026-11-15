# Spec 004 — Web app (`apps/web`)

Status: in progress (`apps/web`): parts 1–2
Design note: `docs/design-note.md` §3, §6, §7

## Goal

A React app where a player plays the focus check, sees what happened in that session, and sees how they are doing over time. It talks only to the API (Spec 003): it never computes or sends a score.

## Players on this device [P]

- On first visit the app creates an anonymous player (`POST /api/players`) and keeps the token in `localStorage`.
- **Local profiles.** A device can hold several players, each with a name the player types (e.g. "Alex"). The name is stored **only in this browser** and never sent to the server, which still knows nothing but a token hash. A header menu shows the active player and lets you switch or add a player. This is how several people share one device, and how the demo shows that each player sees only their own data.
- **Your data** page: explains that clearing browser data loses the history (there is no recovery, by design), and offers **Delete my data** (`DELETE /api/me`, after a confirmation), which also removes the local profile.
- If the API answers `401` for a stored token (the player was deleted elsewhere), the app removes that profile and says so.
- Switching or deleting a player remounts every screen, so no screen can show the previous player's data or keep an open confirmation (which would then act on the next player).

## Flow

```
Home ──▶ Check-in ──▶ (Practice, first time only) ──▶ Get ready ──▶ Trials + probes ──▶ Submitting ──▶ Results
 │                                                                     │
 │                                                                     └─ leave the tab ──▶ "Session voided" ──▶ Home
 ├──▶ Progress
 └──▶ Your data
```

1. **Home:** "Catch every 3, keep a steady rhythm." Shows this week's days played against the weekly target (4 of 7), when the baseline will be ready ("3 more sessions"), and a **Start** button.
2. **Check-in (optional):** sleep (poor / ok / good) and stress (low / medium / high), each skippable. Sent with `POST /api/sessions`.
3. **Practice (first session only, or on request):** 18 trials (2 of them 3s, none in the first 3) with feedback for 800 ms after each: "Caught it" (withheld on a 3), "That was a 3" (pressed on a 3), "Missed one" (no press on another digit), or a quiet tick for a correct press, as in the standard SART training block. Generated on the client and never submitted. This per-trial feedback is not a score.
4. **Get ready:** instructions for the device, then a 3-2-1 countdown.
5. **Trials:** 126 trials as planned by the server. No score, counter or feedback is shown during the block.
6. **Probes:** after each planned probe trial the clock pauses and the app asks "Where was your mind just now?" (On task / Drifting / Elsewhere, also keys 1–3). After the answer there is a 1-second pause, then the trials resume.
7. **Submitting:** sends `{ rts, probeAnswers }`. If the request fails, the player can retry; an identical retry is safe (Spec 003).
8. **Results (Spec 004 part 3):** the session journey ribbon (every trial: steady stretches, caught and missed 3s, drift reports), longest steady run, catch rate next to median RT and steadiness (RT CV), and any descriptive flags in plain words.
9. **Progress (part 3):** charts of catch rate, omissions, median RT and RT variability per session, the baseline vs recent card, the weekly target, and the exploratory sleep/stress and pre-probe comparisons with their `n` and the "a pattern so far, not a cause" wording.

## Input and timing

- **Device [P]:** a device with a coarse pointer (`matchMedia('(pointer: coarse)')`) uses **touch** (a large tap area); otherwise **keyboard** (Space). The choice is sent as `device` when the session starts, and only that input counts during the session.
- **Stimulus:** digit for 250 ms, then a mask for 900 ms (1150 ms per trial), with the digit's font size from the plan (5 sizes).
- **Clock:** `requestAnimationFrame` drives the display; the onset of a trial is the timestamp of the frame that first shows its digit. Presses use `event.timeStamp`. Both are on the `performance.now()` clock.
- **RT:** `press time − onset` for the first press in that trial's 1150 ms window, otherwise `null`. Further presses in the window are ignored, and so are key-repeat events from holding Space.
- **Which trial a press belongs to** is decided by its timestamp, not by when the event is handled: a press belongs to the trial whose window `[onset, onset + 1150)` contains it. A press after one window closes but before the next digit is on screen (at most one frame) belongs to no trial, because nothing new was visible yet.
- **The digit is drawn directly** (a DOM update inside the animation-frame callback), not through React state, so it is on screen in the same frame whose timestamp is recorded as its onset.
- **Known limits:** onset is the frame's start time, so the true display time can differ by up to one frame (about 17 ms at 60 Hz), and keyboard and touchscreen latency differ by device. Both are why results are compared only within a player, and why the device is stored.
- **Probes pause the clock:** the next trial's onset is scheduled only after the answer and the 1-second pause.
- **Leaving voids the session:** if the page becomes hidden during the countdown, trials or probes, the session is abandoned: nothing is submitted, and the player sees "Session voided — leaving the page interrupts the timing" (design note §5).

## Accessibility and look

- Calm, high-contrast colours; respects `prefers-reduced-motion` (no animated transitions) and the system colour scheme.
- Everything outside the trial block works with a keyboard and a screen reader. During the block, the digit area is not announced (it would interfere with the task).
- Usable at phone width.

## Test cases

**Unit (Vitest, jsdom)**

- Trial runner, driven by synthetic frame and press times:
  - RT = press − onset of the frame that showed the digit;
  - only the first press in a window counts; key repeats are ignored;
  - a press after 1150 ms belongs to the next trial once its digit is shown, and to no trial in the gap before that;
  - a press handled after a later frame still counts for the trial whose window contains its timestamp;
  - no press → `null`;
  - the clock pauses at a probe and resumes after the answer plus 1 s;
  - a full session driven by synthetic frames has one RT per trial and one answer per probe, passes core's `validateSubmission`, and takes at least `SUBMIT_CONFIG.minElapsedMs`;
  - practice mode shows the right feedback after each trial.
- Play screen, driven by a fake frame clock: a first-time player goes check-in → practice → ready → countdown → trials and probes → submit, and the submitted body passes `validateSubmission`; hiding the page mid-session voids it and submits nothing.
- Device detection: coarse pointer → `touch`, otherwise `keyboard`.
- Weekly target: counts distinct local calendar days with a completed session in the last 7 days.
- Profiles: create, switch, rename, remove; a `401` removes the profile; exactly one player is created on a first visit, even under StrictMode.
- Screens: after a player switch or deletion, no open confirmation and no previous player's data are shown, even while the next player's data is still loading.
- API client: sends the bearer token; maps `400`, `401`, `409`, `422` to typed errors.

**End-to-end (Playwright, real API and database, part 3)**

- A new player plays a full session (with accelerated input) and sees results; a second player on the same device does not see the first player's session.
- Hiding the page during trials voids the session and submits nothing.

## Delivery

Three PRs, tracked in `tasks.md`: (1) app skeleton, API client and player profiles; (2) the game; (3) results, progress and end-to-end tests.

## Out of scope

Accounts or login, token recovery, sharing results, notifications, offline play, leaderboards, a deployed environment.

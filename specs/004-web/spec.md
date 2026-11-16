# Spec 004 — Web app (`apps/web`)

Status: implemented (`apps/web`)
Design note: `docs/design-note.md` §3, §6, §7

## Goal

A React app where a player plays the focus check, sees what happened in that session, and sees how they are doing over time. It talks only to the API (Spec 003): it never computes or sends a score.

## Players on this device [P]

- On first visit the app creates an anonymous player (`POST /api/players`) and keeps the token in `localStorage`.
- **Local profiles.** A device can hold several players, each with a name the player types (e.g. "Alex"). The name is stored **only in this browser** and never sent to the server, which still knows nothing but a token hash. The header shows the active player as an avatar (their initial); its menu lets you switch player, add a player, or open Your data. The menu follows the WAI-ARIA menu-button pattern (keyboard open, arrow keys, Escape closes and returns focus). "Add player" opens a modal dialog ("Add a player": a Name field, Create and Cancel); Escape or Cancel closes it, and focus returns to the avatar. App-wide notices (a player deleted, or removed because the server no longer knows it) appear as a dismissible bar under the header; when several players are removed at once, one notice gives the count ("2 players no longer exist on the server and were removed from this device."). This is how several people share one device, and how the demo shows that each player sees only their own data.
- **Your data** page: explains that clearing browser data loses the history (there is no recovery, by design), and offers **Delete my data** (`DELETE /api/me`, after a confirmation), which also removes the local profile.
- If the API answers `401` for a stored token (the player was deleted elsewhere), the app removes that profile and says so.
- Switching or deleting a player remounts every screen, so no screen can show the previous player's data or keep an open confirmation (which would then act on the next player).

## Flow

```
First session:  Home ──▶ Check-in ──▶ How to play + Practice ──▶ Get ready ──▶ Countdown ──▶ Trials + probes ──▶ Submitting ──▶ Results
Returning:      Home ──▶ Check-in ─(Start / Skip)─────────────────────────────▶ Countdown ──▶ Trials + probes ──▶ …
                           └─ How to play ──▶ Get ready (Start, or Practice again ──▶ Practice ──▶ Get ready)
During countdown, trials and probes (focus mode): leave the tab ──▶ "Session voided" ──▶ Home
Home ──▶ Progress, Your data
```

A player is **returning** once they have a completed session (`GET /api/sessions` is not empty); otherwise it is their first session.

1. **Home:** "Hi, {name}" and "Three minutes. Catch every digit, hold back on 3." Groups separated by thin rules, no boxes:
   - **Last 7 days:** the days played against the weekly target as a large serif number ("3 of 4 days"; from the target on: "5 days, goal reached"), then one dot per day for the last 7 local days, today last, labelled with the weekday's initial. Played days are filled sage; today has a dashed ring until it is played. The target comes from core's `PROGRESS_CONFIG`.
   - **Last check · {day}:** the latest session's catch rate (`1 − commissionRate`), longest steady run and median response, as large serif numbers with small labels, all left-aligned, the same values as Results. With no median the number is "—" with a one-line note, "Not enough data", under it. The day reads "Today", "Yesterday", a weekday within the last 7 days, then a date ("9 Nov"). With no sessions: "No checks yet. Your first one starts with a short practice."
   - Before the baseline exists: "N more sessions until your starting point".
   - A full-width **Start today's check** button.
2. **Check-in (optional), one screen:** "How are you today?", "Optional. It never changes your score.", then **Sleep** (Poor / OK / Good) and **Stress** (Low / Medium / High) as chips, none chosen by default. Answers are sent with `POST /api/sessions`; a group left empty is left out.
   - **Returning player:** a large **Start** button, then **Skip** (bottom left: start without any check-in, even if a chip was chosen) and **How to play** (bottom right: the Get ready screen, with Start and Practice again; the answers are kept). Start and Skip go straight to the countdown, without the rules or practice.
   - **First session:** a large **Continue** button and **Skip**; both lead to the rules and the practice round.
3. **How to play (before practice, and on Get ready):** the rules, shown as steps with an example: a digit flashes in the middle of the screen and turns into `⊗`; press (Space, or tap the screen on a touch device) for every digit as soon as it appears; **not for 3**; a press still counts while `⊗` is showing. It also says, before the player finds out the hard way, that 3s are rare and come fast, that everyone presses on some of them, and that this is what the check measures, so speed and accuracy matter equally.
4. **Practice (first session, or "Practice again" from How to play):** 18 trials (2 of them 3s, none in the first 3) that **start slow and end at the real speed [P]**: trials 1–6 show the digit for 800 ms + 1200 ms mask, trials 7–12 500 ms + 1000 ms, trials 13–18 the real 250 ms + 900 ms. The rule ("Press Space for every digit except 3", or "Tap for every digit except 3") stays on screen under the digit. After each trial, feedback for 800 ms: "Caught it" (withheld on a 3), "That was a 3, let it pass" (pressed on a 3), "Missed one, press for every digit except 3" (no press on another digit), or a quiet tick for a correct press, as in the standard SART training block. Generated on the client and never submitted. This per-trial feedback is not a score.
5. **Get ready (after practice, or from How to play):** the same how-to-play steps for the device, Start and Practice again. Start begins a 3-2-1 countdown.
6. **Trials:** 126 trials as planned by the server. No score, counter, progress bar, remaining count, timer or feedback is shown during the block: knowing how far along you are changes how people respond.
   - **Focus mode** (countdown, practice or real trials, and probes): the header and all navigation are removed (the layout drops them while the block is mounted) and the stage fills the screen on the content-surface colour. The digit is Inter 700, tabular figures, near-black, centred; the five plan sizes keep the PsyToolkit ratios (48–120) of a largest size of about 240 px that scales down with the viewport. One small line at the bottom: "Space for every digit except 3" (touch: "Tap for every digit except 3"). On a touch device the whole screen is the tap area.
7. **Probes:** after each planned probe trial the clock pauses and the app asks "Where was your mind just now?" (three large buttons, On task / Drifting / Elsewhere, also keys 1–3). After the answer there is a 1-second pause, then the trials resume.
8. **Submitting:** sends `{ rts, probeAnswers }`. If the request fails, the player can retry; an identical retry is safe (Spec 003).
9. **Results (Spec 004 part 3):** reached after a submit (the session comes with the navigation) or by its URL (the session is loaded from `GET /api/sessions`; one the player does not own, or an unknown id, shows "Session not found"). It shows, all from the server's score:
   - a one-line summary: "You caught X of Y 3s", where X and Y are counted from `trialOutcomes`;
   - the **session journey ribbon**: one cell per trial, in order, coloured by its outcome (steady, caught 3, pressed on a 3, missed digit, too early), with the longest steady run underlined and a marker after each probe trial labelled with the answer (On task / Drifting / Elsewhere). It is drawn in three rows of 42 trials (about 48 s each) so it fits a phone. A legend explains the colours; screen readers get one text summary instead of 126 cells;
   - the session's numbers, each a large serif number over a small label: catch rate (`1 − commissionRate`), median response time (`medianGoRtMs`), rhythm variability (`rtCv` as a percentage, "lower is steadier"), missed digits (`omissions`), longest steady run. A `null` RT statistic reads "Not enough presses to measure";
   - any descriptive flags in plain words, framed as "about this session", never as a failure:
     - `high_omissions`: "You let many digits pass without pressing. If something interrupted you, this session may not reflect your focus.";
     - `many_anticipations`: "Many presses came very early, before a digit could really be seen.";
     - `regular_timing`: "Your timing was unusually even, which is more typical of automated input than of people.";
   - a primary "Back to home" button and a secondary "See your progress" button.
10. **Progress (part 3):** at `/progress`, linked from the header. It loads `GET /api/sessions` (one point per session) and `GET /api/progress` (everything statistical); the web app computes only the weekly target. With no sessions it says so and links to Play. Otherwise, top to bottom:
    - **Last 7 days:** the same block as on Home.
    - **Recent vs. where you started:** before the baseline exists, "Your starting point is set after N more sessions" (session 1 is practice). Afterwards, a row per metric with the baseline median, the recent median and their `n`: catch rate (`1 − commissionRate`), missed digits (`omissionRate`), median response (ms), rhythm variability (`rtCv`, "lower is steadier"). No arrows or "better/worse" words: a faster response with more errors is not simply better.
    - **Charts (Recharts):** four small line charts side by side (two columns, one on a phone), x = session number. The line and points are sage; the practice session is a hollow circle and labelled "practice"; a session with a flag is a hollow diamond in the warning colour, with the flag in the tooltip, so shape (not only colour) tells them apart; the baseline median is a dashed muted line labelled "where you started" once it exists. A legend above the charts names these marks. Grid and axes are faint (border and muted colours). Each chart has a text caption with the latest value (a serif number), for screen readers. Medians in the "recent vs. where you started" table are serif numbers too.
    - **Exploring patterns (exploratory):** a metric picker (catch rate by default), then for sleep and for stress a dot plot per level ("Poor · n = 3"). A level's median is drawn only when the server returns one (n ≥ 10). When `canSummarise` is true, one sentence names the groups' medians and ends "This is a pattern so far, not a cause."; otherwise "Each group needs at least 10 sessions before Steady describes a pattern." Pre-probe variability by probe answer is shown the same way. Each group's sessions are sage dots on a faint track; a group's median is a dark bar (a different shape, not just a different colour) with the value as a serif number. On a phone the track gets its own row under the label.

## Input and timing

- **Device [P]:** a device with a coarse pointer (`matchMedia('(pointer: coarse)')`) uses **touch** (a large tap area); otherwise **keyboard** (Space). The choice is sent as `device` when the session starts, and only that input counts during the session.
- **Stimulus:** digit for 250 ms, then a mask for 900 ms (1150 ms per trial), with the digit's font size from the plan (5 sizes). This is the standard SART timing and the real session never changes it, so results stay comparable with the research and between sessions. Only practice uses slower trials (above); the runner takes an optional per-trial timing, and the window for a press is that trial's digit + mask time.
- **Clock:** `requestAnimationFrame` drives the display; the onset of a trial is the timestamp of the frame that first shows its digit. Presses use `event.timeStamp`. Both are on the `performance.now()` clock.
- **RT:** `press time − onset` for the first press in that trial's 1150 ms window, otherwise `null`. Further presses in the window are ignored, and so are key-repeat events from holding Space.
- **Which trial a press belongs to** is decided by its timestamp, not by when the event is handled: a press belongs to the trial whose window `[onset, onset + 1150)` contains it. A press after one window closes but before the next digit is on screen (at most one frame) belongs to no trial, because nothing new was visible yet.
- **The digit is drawn directly** (a DOM update inside the animation-frame callback), not through React state, so it is on screen in the same frame whose timestamp is recorded as its onset.
- **Known limits:** onset is the frame's start time, so the true display time can differ by up to one frame (about 17 ms at 60 Hz), and keyboard and touchscreen latency differ by device. Both are why results are compared only within a player, and why the device is stored.
- **Probes pause the clock:** the next trial's onset is scheduled only after the answer and the 1-second pause.
- **Leaving voids the session:** if the page becomes hidden during the countdown, trials or probes, the session is abandoned: nothing is submitted, and the player sees "Session voided — leaving the page interrupts the timing" (design note §5).

## Accessibility and look

- "Quiet paper" look (approved design, 2026-11-16): warm paper surfaces, a sage accent, Fraunces headings and Inter text. Every colour, font, size, space and radius is a CSS variable in `src/styles/tokens.css`, with a dark set for `prefers-color-scheme: dark`; text colours are adjusted where needed to meet WCAG AA. Shared controls live in `src/ui` (Button, Chip/ChipGroup on native radios, Card) with CSS Modules.
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
  - a trial with its own timing shows the digit and mask for that long, and its press window is that long.
- Practice plan: trials 1–6, 7–12 and 13–18 use the three practice speeds; the last six use the real timing.
- Play screen, driven by a fake frame clock: a first-time player goes check-in → practice → ready → countdown → trials and probes → submit, and the submitted body passes `validateSubmission`; hiding the page mid-session voids it and submits nothing. The how-to-play steps (including "not for 3") are shown before practice and on Get ready, and the rule reminder stays visible during practice.
- Check-in and flow: a returning player sees one check-in screen (Sleep and Stress chips, none chosen; Start, Skip, How to play); Start goes straight to the countdown with the chosen answers; Skip sends no check-in even if a chip was chosen; How to play shows the rules, keeps the answers and offers Practice again; a first-time player continues (or skips) to the practice round.
- Focus mode: while the block runs there is no header, navigation, progress bar or remaining count, only the one-line hint; the header returns on Results; the probe still takes keys 1–3; and React commits stay at the phase changes (countdown, probe, resume), not one per trial (checked with a `Profiler`).
- Device detection: coarse pointer → `touch`, otherwise `keyboard`.
- Results screen: the summary, one ribbon cell per trial with the server's outcome, the longest run marked, one labelled marker per probe, the tiles (including "Not enough presses to measure"), flags in plain words; it loads the session by URL when there is no navigation state, and shows "Session not found" for an id the player does not have.
- Weekly target: counts distinct local calendar days with a completed session in the last 7 days (today and the 6 days before it, by the device's clock and time zone); two sessions on one day count once; a session at 23:59 seven days ago does not count and one at 00:01 six days ago does; the per-day dots line up with the days.
- Home screen: the greeting and the start link; with no sessions, an empty week, the first-check invitation and "6 more sessions"; before the baseline, the last check's three numbers (catch rate as `1 − commissionRate`) and the countdown; after it, no countdown, and "Not enough presses to measure" for a missing median; the weekly target from core's config and "goal reached". Week dots: weekday initials, played days and today marked. `lastCheckDay`: Today, Yesterday, weekday, then date.
- Progress screen: the empty state; the starting-point countdown; the baseline/recent rows with `n` and catch rate as `1 − commissionRate`; chart points with practice (circle) and flagged (diamond) sessions told apart by shape; group dots with `n`, a median only when the server sent one, and the pattern sentence only when `canSummarise`.
- Profiles: create, switch, rename, remove; a `401` removes the profile; exactly one player is created on a first visit, even under StrictMode.
- Screens: after a player switch or deletion, no open confirmation and no previous player's data are shown, even while the next player's data is still loading.
- API client: sends the bearer token; maps `400`, `401`, `409`, `422` to typed errors.

**End-to-end (Playwright, real API and database, part 3)**

- A new player goes through practice and a full session (with no header while the block runs), played by the test with real key presses (Space for every digit except 3, "1" at each probe), and sees the results page with the journey ribbon and the progress page with one session. It runs in **real time** (about 3.5 minutes): the server checks real elapsed time, and the app has no test-only shortcut.
- A second player added on the same device sees no sessions on Progress, and "Session not found" at the first player's results URL; switching back shows the first player's session again. As a returning player, Skip on the check-in goes straight to the countdown, without the rules or practice.
- Hiding the page during trials (a `visibilitychange` to `hidden`) voids the session: the page says so, and the API lists no completed session for that player.
- They run against the real API and Postgres (`pnpm e2e`, Chromium only) in a separate CI job, `e2e`.

## Delivery

Tracked in `tasks.md`: (1) app skeleton, API client and player profiles; (2) the game; (3) results, progress and end-to-end tests, split into 3a results, 3b progress, 3c end-to-end tests and README.

## Out of scope

Accounts or login, token recovery, sharing results, notifications, offline play, leaderboards, a deployed environment.

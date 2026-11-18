# Spec 006: The lantern, points, and a calm/game A/B split

Status: implemented; Spec 020 draws the countdown's "Space" (touch: "the screen") as a key; Spec 021 mists the glass during the countdown
Design note: `docs/design-note.md` §3
Depends on: Spec 005
Changes: Spec 001 (`trialOutcome`, one rule for every outcome), Spec 003 (`variant` on players and sessions), Spec 004 (focus mode, mask, countdown, feedback during the block)

## Why

Play-testing the earlier screens (2026-11-17): the black `⊗` mask read as "wrong answer", the game looked like a form, and nothing during a session told the player that a press had counted. Other gamified go/no-go tasks show what works and what does not:

- **Points do not hurt the data** and make the task more enjoyable; themed stimuli (cowboys instead of shapes) raised no-go errors by 28% [R] (Lumsden et al. 2016, PeerJ). So the digits and the 3 stay as they are, and the fun goes around them.
- **Feedback on a correct press:** PsyToolkit's SART 2 turns the mask green after a correct press, because the original SART gives no sign that a press counted [R] (Stoet, PsyToolkit SART 2).
- **The surroundings as feedback:** _Tenacity_ changes its landscape as the player stays on task [R] (Patsenko et al. 2019).

One risk is real: a visible streak may make people slow down to keep it, which would change the speed and rhythm Steady measures [P]. So the game layer is an experiment: half of the players get it, half do not, and every session records which (§5).

## 1. The scene (calm and game; the plain variant of Spec 008 has none)

From the countdown to the last trial (focus mode), the screen is a night scene, always dark whatever the system theme: a sky gradient, a few stars, two layers of hills, and a **lantern** in the middle. The rest of the app keeps the paper look.

- **The digit** is drawn on the lantern's glass, in Fraunces (the heading face), dark on the warm glass, at the plan's five sizes (unchanged ratios). It is still written straight into the DOM in the frame that becomes its onset (Spec 004).
- **The mask is frost [P]:** at the end of the 250 ms digit, the glass mists over: a soft, textured layer covers the digit's whole area for 900 ms. Like the `⊗` it covers the place where the digit was (backward masking), but it is a texture, not a symbol, so it cannot be read as a verdict. It replaces the `⊗` in practice and in the real session; the timing is unchanged.
- **The countdown** is three words, "Ready", "Set", "Go", one a second, with three dots filling under them. No number appears.
- **A press is acknowledged at once [P]** (as in SART 2): the lantern glows warm after a press on a digit at or after 100 ms, and flickers red after a press on a 3 or a press under 100 ms. Nothing happens without a press. The glow comes after the press, so it cannot change that press's RT. It shows in both variants, in practice and in the real session.
- **The probe** opens over the scene: "Where was your mind just now?", the three answers, and "Your answer never changes your points." in the game variant.
- With `prefers-reduced-motion`, nothing moves: the glow and the colour changes are instant, and fireflies (below) do not drift.
- The scene is static apart from these class and CSS-variable changes, made outside React, so React still commits only at the phase changes (Spec 004).

## 2. Points (game variant) [P]

Rules, in core's `GAME_CONFIG` and one pure function `scorePoints(trialOutcomes)`:

- Trials are taken in order. A **correct trial** is `steady` (a press on a digit, not too early) or `caught` (a 3 held back); any other outcome (`commission`, `omission`, `anticipation`) ends the streak.
- The n-th correct trial in a row earns **base × multiplier(n)**: base 10 for `steady`, 30 for `caught`; multiplier 1 for n = 1–4, **2** from 5, **3** from 15, **5** from 30.
- A slip resets the streak (and so the multiplier) to zero. Points already earned are never taken away.
- `maxPoints(trials)`: the points of a session with every trial correct.

**One count, never stored.** A session's points are always `scorePoints(trialOutcomes)` of its outcomes, and an outcome always comes from core's `trialOutcome(isTarget, rt)`, the rule `scoreSession` uses. During the block the page recomputes the points from the outcomes known so far (`pointsSoFar`); after it, Results, Home and Progress take the server's `trialOutcomes`. The same presses give the same outcomes, so the live count and every later screen agree. The points are never sent, never stored, and never part of the score.

**What the game variant shows during the block**

- The points, top left, in Fraunces, and the multiplier ("×2"), top right. A small "+10" floats up from the lantern for each award.
- **Fireflies:** each correct trial in the current streak adds a firefly (at most 30 on screen). A slip scatters them.
- **Dawn:** the sky lightens from night towards dawn as the points grow: the share of `maxPoints` earned so far sets a CSS variable that blends the sky, hills and stars. The longer the streak, the warmer the lantern's light.
- No count of trials, no time left, no progress bar: as before, nothing says how far along the block is. The points rise without a known end.

The calm variant shows none of this: the lantern, the frost and the glow only.

**Practice** uses the variant's look and its points (from 0, never saved), so a new player in the game variant sees the points from the first press. The practice's words after each trial (Spec 004) stay.

## 3. No change to the score

- The score is unchanged (scoring version 3). Points are not stored: anything that needs them (Results, a personal best, a comparison between the variants in SQL) derives them from the stored `trialOutcomes` with `scorePoints`.
- The trial outcome rule moves into one exported function, `trialOutcome`, so the server's scoring and the live display cannot drift apart.

## 4. Results (game variant)

Above the conclusion, the game first: **{points} points**, "Longest streak: {longestSteadyRun}" and "Dawn {p}%" (points ÷ `maxPoints` of the session's trials, rounded down). The measurement part follows unchanged. The calm variant's Results are unchanged.

## 5. The A/B split [P]

- **Variants:** `calm` (the scene, frost and glow) and `game` (plus points, multiplier, fireflies and dawn). Everything else is the same for both.
- **Assignment:** `POST /api/players` puts each new player in one of the two at random (50/50, server-side), stored as `players.variant`. Players created before this change are assigned at random by the migration. Spec 008 adds a third group, `plain` (the original screen), and splits new players a third each.
- **Sticky:** a player keeps the variant, so their baseline and history come from one variant.
- **Recorded per session:** `POST /api/sessions` returns the session's `variant`, and stores it as `sessions.variant`; `GET /api/sessions` returns it with each completed session.
- **Override for play-tests:** opening the app with `?variant=calm` or `?variant=game` makes this browser send that variant with each new session (`POST /api/sessions` with `variant`), until the app is reopened without it; the session stores the variant actually shown.
- **Comparison** is only between groups, in SQL (e.g. sessions per player per week, completion, median RT, RT CV, catch rate by `sessions.variant`). There is no dashboard and no comparison between individual players.

## 6. Out of scope

Home, Results and Progress redesign, personal bests and the sky collection (Spec 007); unlockable scenes (later, once there is retention data); sound.

## Test cases

**Core**

- `scorePoints`, against values worked out by hand from this spec: an empty list is 0; 4 steady = 40; 5 steady = 4 × 10 + 20 = 60; a caught 3 as the 5th correct trial = 40 + 60 = 100; a slip after 6 steady resets: 6 steady, commission, 5 steady = (40 + 20 + 20) + (40 + 20) = 140; 30 steady = 4 × 10 + 10 × 20 + 15 × 30 + 1 × 50 = 740; omissions and anticipations never earn.
- `createPointsCounter` gives the same totals step by step, with `gained`, `streak` and `multiplier` after each trial.
- `maxPoints` equals `scorePoints` of an all-correct session.
- The score has no `points` and stays at scoring version 3; `scorePoints(trialOutcomes)` of a perfect session equals `maxPoints`.
- `trialOutcome` gives the same outcome as `scoreSession` on every trial of 50 random sessions, and follows Spec 001 at the edges (a 3 at any RT, 99 vs 100 ms).
- `pointsSoFar` is the counter's last step (all zero for no outcomes).

**API**

- A new player gets `calm` or `game`; over 200 new players both occur.
- A session stores and returns the player's variant; a `variant` in the start body overrides it and is stored; an unknown variant is `400`.
- The migration adds `players.variant` and `sessions.variant`.

**Web**

- Focus mode: the scene and lantern are drawn; the countdown shows Ready, Set, Go and no digit; the mask is the frost (no `⊗` anywhere).
- A press on a digit lights the lantern (`data-glow="ok"`), a press on a 3 or too early flickers it (`data-glow="bad"`), in both variants.
- Game variant: the points shown at the end of a simulated session equal core's `scorePoints` of that session's outcomes; the multiplier reaches ×2 after 5 correct trials; fireflies appear and scatter after a slip; the dawn variable rises; no trial count or remaining time is shown.
- Calm variant: no points, multiplier, fireflies or dawn.
- React commits stay at the phase changes in the game variant too.
- `?variant=game` is sent with the next session; without it, no variant is sent.
- Results: the game block for a game session (points, longest streak, dawn %), none for a calm one.

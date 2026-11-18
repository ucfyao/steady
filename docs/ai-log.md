# Development log

Steady is built with Claude Code as a pair programmer, under the workflow in [CLAUDE.md](../CLAUDE.md): spec first, tests first with independent expectations, deliberate breakage, real-browser checks, and review of every pull request. This log records each time the AI's output was wrong or weak, how it was caught, and the fix. A new entry is added in the pull request where the problem was found. A lesson that could recur becomes a standing instruction, so the same mistake is not made twice: a rule in CLAUDE.md, an entry in the agent's persistent memory, or a reusable skill. Pull requests are also reviewed by a second model (OpenAI Codex).

## Summary

70 entries, grouped by the kind of mistake.

| Kind of mistake                                                    | Entries | Caught by                                    |
| ------------------------------------------------------------------ | ------- | -------------------------------------------- |
| [Tests that could not fail](#tests-that-could-not-fail)            | 11      | Running each new test before the code exists |
| [Rules with no test](#rules-with-no-test)                          | 6       | Mutation checks                              |
| [Races and flaky tests](#races-and-flaky-tests)                    | 5       | Full-suite runs, CI, injected delays         |
| [Only visible in a real browser](#only-visible-in-a-real-browser)  | 12      | Screenshots and keyboard walkthroughs        |
| [Product judgement](#product-judgement)                            | 6       | A person using the app                       |
| [A second code path missed](#a-second-code-path-missed)            | 6       | Real-browser runs, outside review, e2e       |
| [Git and shell commands](#git-and-shell-commands)                  | 10      | Reading command output, permission checks    |
| [Tooling, runtime and deployment](#tooling-runtime-and-deployment) | 8       | Logs, preview deployments, platform settings |
| [Docs and claims](#docs-and-claims)                                | 6       | Re-reading against the code before merging   |

Entry numbers are in the order the problems were found; other entries refer to them by number.

## Tests that could not fail

A test that passes against a stub, by chance, or for the wrong reason proves nothing. Seeing every new test fail first, for the right reason, caught these.

### 5. `core` stats test

<sub><a href="https://github.com/ucfyao/steady/pull/4">PR #4</a></sub>

"`probit` rejects 0 and 1" only asserted that something was thrown, so it **passed against a stub that throws for every input**.

- **Caught by:** Running each new test against a throwing stub before implementing (TDD red step)
- **Fix:** The test now requires a `RangeError`

### 7. `core` check-in contract test

<sub><a href="https://github.com/ucfyao/steady/pull/5">PR #5</a></sub>

"Accepts partial and empty check-ins" passed against a `z.any()` stub, so it did not pin the schema's shape.

- **Caught by:** TDD red step against a permissive stub
- **Fix:** Added "drops unknown fields", which fails against the stub

### 15. Web: stale-data test

<sub><a href="https://github.com/ucfyao/steady/pull/10">PR #10</a></sub>

The first test for "never show the previous player's session count" passed even with the fix removed, because the fake API answered instantly and replaced the old count before the assertion.

- **Caught by:** Removing the fix and re-running the tests
- **Fix:** The next player's request now never resolves in that test, so a stale count would stay visible; the test fails without the fix

### 19. End-to-end test helper

<sub><a href="https://github.com/ucfyao/steady/pull/14">PR #14</a></sub>

The helper that plays a block treated "no game box on screen" as the end of the block. Right after Start, the page shows "Loading…" while the server creates the session, so the helper returned at once and pressed nothing. Without a count check, the test would have passed without playing.

- **Caught by:** The test asserts 112 presses and 4 probe answers; it failed with 0
- **Fix:** The helper waits for the game box to appear before playing; both tests pass, and breaking voiding or the API's player filter makes them fail

### 20. Web: check-in tests

<sub><a href="https://github.com/ucfyao/steady/pull/16">PR #16</a></sub>

While writing the failing tests for the new check-in, the agent left two broken tests in the file: one named "Skip starts the session without a check-in" that actually pressed Start and only counted sessions, and a placeholder that swallowed its own error and asserted nothing. Both would have passed whatever Skip did.

- **Caught by:** The agent's own review of the test list before running it
- **Fix:** Both removed; the Skip rule is covered by one test that chooses a chip, presses Skip, and expects no check-in in the request

### 22. Web: Home goal test

<sub><a href="https://github.com/ucfyao/steady/pull/17">PR #17</a></sub>

The test for "goal reached" used 5 played days against a target of 4, so it also passed with `count > target` instead of `count >= target`.

- **Caught by:** Mutation check on the new Home logic (4 of 5 caught at first)
- **Fix:** The test now uses exactly 4 days; 5 of 5 caught

### 29. Play flow v2 end-to-end test

<sub><a href="https://github.com/ucfyao/steady/pull/19">PR #19</a></sub>

The agent's new end-to-end check expected the practice result to show "16 / 16 digits caught". The test helper presses within a few ms of each digit, under the 100 ms anticipation threshold, so the app correctly showed 0 caught and 16 too early. A fixed "16 too early" would have been flaky on a slower machine instead.

- **Caught by:** The first `pnpm e2e` run on the branch
- **Fix:** The test checks what the helper guarantees: both 3s held back, and caught + too early = 16

### 41. Lantern scene tests

<sub>Spec 006, <a href="https://github.com/ucfyao/steady/pull/29">PR #29</a></sub>

The agent wrote the lantern and game-layer tests together with the implementation, so they ran green on the first run and were never seen failing, against the project's TDD rule.

- **Caught by:** The agent's own review of the run, before committing
- **Fix:** Seven deliberate breaks (points off by one, no red glow, no frost, the game layer shown in calm, no firefly cap, no scatter, no dawn), each caught by a test

### 56. Choosing a new player's group

<sub>Spec 011, <a href="https://github.com/ucfyao/steady/pull/40">PR #40</a></sub>

The agent's test created one player per variant and checked its group. With the rule broken (the API drawing at random), all three still matched one time in 27, and the deliberate break did pass once.

- **Caught by:** The deliberate break: it passed, then failed on three reruns, which pointed at chance
- **Fix:** Five players per variant: a random draw matches all 15 about once in 14 million

### 69. Practice result legend test

<sub>Spec 023, <a href="https://github.com/ucfyao/steady/pull/48">PR #48</a></sub>

The agent's deliberate break of the legend (listing every outcome) made the test fail, but for the wrong reason: the legend sits in an `aria-hidden` block, so the role query found nothing in either version. The passing run was never green with the real code.

- **Caught by:** The failure message on the restored code ("Unable to find … listitem")
- **Fix:** The test reads the legend's items from the DOM; the break then failed on the list's contents and the real code passed

### 70. One sky

<sub>Spec 028, <a href="https://github.com/ucfyao/steady/pull/51">PR #51</a></sub>

The agent's first test for "the header lies on the scene while a notice is shown" put a second player on the fake server before the app started. The fake gives tokens in order, so that player took the first token and became the only player; the switch never happened and the test failed waiting for the notice, not for the missing scene.

- **Caught by:** The failure message ("Unable to find … That player no longer exists.") while confirming the new tests failed for the right reason
- **Fix:** The test adds the second player through Manage players, as the Spec 014 test did; it then failed on the missing scene and passed with the change

## Rules with no test

Code that every test ignored. Breaking each new rule on purpose (a mutation check) and reading the code against the spec found them.

### 6. `core` scoring tests

<sub><a href="https://github.com/ucfyao/steady/pull/4">PR #4</a></sub>

Two rules had no test: an anticipation (RT < 100 ms) must break the longest steady run, and exactly 10 qualifying RTs must produce RT stats. Breaking either rule left every test green.

- **Caught by:** Mutation check: 15 of 17 deliberate rule breaks were caught at first
- **Fix:** Added both tests and listed them in Spec 001; 17 of 17 are now caught

### 11. API logging

<sub><a href="https://github.com/ucfyao/steady/pull/8">PR #8</a></sub>

No test checked that the `Authorization` header is redacted from request logs (tests ran with logging off). Removing the redaction left every test green.

- **Caught by:** API mutation check: 18 of 19 rule breaks were caught
- **Fix:** The app can take a log destination; a test reads the request log and asserts the token never appears. 19 of 19 are now caught

### 12. API submit race

<sub><a href="https://github.com/ucfyao/steady/pull/8">PR #8</a></sub>

The conditional update that stops two concurrent submits from both winning, and its fallback to retry handling, had no test.

- **Caught by:** Reading the submit code against Spec 003 step 5
- **Fix:** Added tests for two identical and two different concurrent submits; removing the condition fails them (3 of 3 runs)

### 16. Web: trial runner and play screen tests

<sub><a href="https://github.com/ucfyao/steady/pull/11">PR #11</a></sub>

Two rules had no test: a press exactly 1150 ms after onset (window closed, next digit not yet shown) must count for no trial, and taps must not count in a keyboard session. A third "survivor" was a mutation of code that never runs, so it proved nothing.

- **Caught by:** Mutation checks on the runner (9 of 11 caught at first) and the play screen (2 of 4 caught at first)
- **Fix:** Added a window-boundary test and taps on every 3 in the keyboard test; rewrote the ineffective mutation; 11 of 11 and 7 of 7 now caught

### 18. Web: progress screen

<sub><a href="https://github.com/ucfyao/steady/pull/13">PR #13</a></sub>

Three gaps, all with passing tests: the weekly card read "7 of 4 days this week" once the goal was passed (the spec had not considered it); no test covered "only one group has 10 sessions, so no pattern sentence"; and a filter for future sessions was dead code.

- **Caught by:** A real-browser look at 22 seeded sessions (the first), and a mutation check (10 of 12 caught at first; the other two)
- **Fix:** "Goal reached: X days this week" with a test and a spec line; a test with groups of 10 and 8; the dead filter removed. 11 of 11 now caught

### 26. Play flow v2

<sub><a href="https://github.com/ucfyao/steady/pull/19">PR #19</a></sub>

"Skip clears the chosen check-in answers" had been in the play screen since the check-in split, with no test: removing the line left every test green, so after a voided session the chips could come back still chosen.

- **Caught by:** Mutation check on the new flow: 14 of 15 deliberate rule breaks were caught at first
- **Fix:** A test (choose, Skip, leave the page, Play again: no chip chosen); the break is now caught

## Races and flaky tests

Tests that read a result before the code under test had finished. They passed locally and failed elsewhere.

### 21. Web: focus mode

<sub><a href="https://github.com/ucfyao/steady/pull/16">PR #16</a></sub>

`useFocusMode` hid the header from a `useEffect`, which runs after paint, so the first countdown frame could still show the header. The test "hides the header during the block" passed locally in the full suite but failed in CI; run on its own it failed 5 of 6 times.

- **Caught by:** CI on the PR
- **Fix:** A layout effect hides the header before the first frame; the same test passes 10 of 10 runs on its own and in CI

### 31. Results comparisons

<sub><a href="https://github.com/ucfyao/steady/pull/21">PR #21</a></sub>

The new tests for the Results conclusion found the conclusion element and then checked its text. The element is there from the first render, empty until the history loads, so the check raced the fake API: all tests passed alone, and 2–3 of them failed in every full run.

- **Caught by:** Running the whole web suite, not only the new file, before committing
- **Fix:** The tests wait for the text itself (`waitFor`); three full runs in a row pass

### 32. Import link tests

<sub><a href="https://github.com/ucfyao/steady/pull/20">PR #20</a>, found in <a href="https://github.com/ucfyao/steady/pull/22">PR #22</a></sub>

The import tests read the saved players from `localStorage` right after the page showed its result. Players are saved in an effect, which can run after the result is on screen, so the check raced it: it passed in every local run and failed occasionally elsewhere.

- **Caught by:** Reported as flaky; 20 single and 12 parallel full runs could not reproduce it, so the agent delayed the save by 5 ms on purpose and four of the five import tests failed
- **Fix:** The tests wait for the saved players (`waitFor`); they pass with the 5 ms delay in place

### 40. Player profile tests

<sub>found on <a href="https://github.com/ucfyao/steady/pull/26">PR #26</a>, fixed in <a href="https://github.com/ucfyao/steady/pull/27">PR #27</a></sub>

When fixing #32, the agent made only the import tests wait for the saved players. Two tests in `players-provider.test.tsx` read `localStorage` straight after the screen showed the result, the same race, and failed once in CI on a PR that changed only the workflow file.

- **Caught by:** A CI failure on #26 (`check`, then green on a re-run)
- **Fix:** Both tests wait for the save (`waitFor`). With a 5 ms delay put into the save, the two tests failed before the fix and pass after it; with the save removed they still fail

### 68. End-to-end helper

<sub>Spec 016, <a href="https://github.com/ucfyao/steady/pull/48">PR #48</a></sub>

`asNewPlayer` opens the app, then writes the new player into `localStorage`. The app saves its own active player once the player list arrives, so on a slow list it overwrote the new player with the first one (O-Ava, a returning player) and "leaving the page voids the session" waited 6 minutes for a practice button that a returning player never sees.

- **Caught by:** The e2e job on #47 failed once and passed on a rerun; the trace showed O-Ava on Before you start
- **Fix:** The helper now selects the player with an init script that runs before the app, once per tab, so a later switch in the menu survives navigation; the e2e suite passes

## Only visible in a real browser

Layout, contrast and focus faults with every test green. Screenshots at several widths, in light and dark, and keyboard walkthroughs caught them.

### 24. Progress charts and Home

<sub><a href="https://github.com/ucfyao/steady/pull/18">PR #18</a></sub>

Three things passed every test and the browser checks: the Y axis of a narrow chart read "4%, 3%, 3%, 3%, 2%" (Recharts' ticks rounded to whole percents); a missing median on Home was right-aligned with a long note that wrapped over several lines on a phone; and `styles.css` still held about 50 classes from before the redesign that nothing used.

- **Caught by:** The owner's review of the running app and the code
- **Fix:** Axis ticks are computed in `progress/axis.ts` with as many decimals as keep labels distinct (tests, mutation-checked); "—" plus "Not enough data", left-aligned; unused classes deleted and the rest moved into CSS Modules

### 25. Add-player dialog

<sub><a href="https://github.com/ucfyao/steady/pull/18">PR #18</a></sub>

The new modal returned focus to the avatar before closing itself. In a browser the page behind an open modal is inert, so the focus call was ignored and focus fell to the page; the unit tests passed because the jsdom stand-in for `showModal` did not make anything inert.

- **Caught by:** The end-to-end test (Escape, then "avatar is focused") in a real browser
- **Fix:** The dialog closes before focus moves; the test stand-in now blocks focus outside an open modal, and with it the old order fails both unit tests

### 42. Lantern scene look

<sub>Spec 006, <a href="https://github.com/ucfyao/steady/pull/29">PR #29</a></sub>

With every test green, real screenshots showed three faults: two white highlights on the frost read as a face; the probe let the lantern show through, with dark button text on the dark scene; and "Before you start" still had a "3′" icon next to "About two minutes" (left over from Spec 005).

- **Caught by:** Real-browser screenshots at 390 px of a whole practice and session
- **Fix:** A woven frost texture; a full-screen probe backdrop with light buttons; the icon reads 2′

### 44. Home, Results and Progress redesign

<sub>Spec 007, <a href="https://github.com/ucfyao/steady/pull/30">PR #30</a></sub>

With all tests green, screenshots showed the hero's light text turning unreadable as the sky lightened towards dawn, and the mid-dawn skies in the gallery coming out a muddy grey from the colour blend. A new test also clicked "Show all" with a bare `.click()`, outside React's `act`, so it failed for a reason that had nothing to do with the code.

- **Caught by:** Real-browser screenshots at 390 px, light and dark, of the demo player; the test's own failure
- **Fix:** A dark wash under the hero text; a warm sun glow and a curved hill in each sky; `fireEvent.click` in the test

### 48. Stop button

<sub>Spec 009, <a href="https://github.com/ucfyao/steady/pull/33">PR #33</a></sub>

The agent put Stop in the top-right corner without checking what was already there: in the game variant it covered the "×1" multiplier. Every test passed, because no test looks at layout.

- **Caught by:** A real-browser screenshot of each variant at 390 px
- **Fix:** The HUD leaves the top-right corner to Stop; the multiplier sits to its left

### 49. Your data, delete step

<sub>Spec 004, <a href="https://github.com/ucfyao/steady/pull/34">PR #34</a></sub>

Clicking Delete replaced the button with the confirmation, so keyboard focus fell back to the page body; Cancel did the same. Every test passed.

- **Caught by:** A UI/UX review that followed the keyboard path in a real browser
- **Fix:** Focus moves to Cancel on the confirmation step and back to Delete on cancel, with tests (now on Manage players)

### 53. Page layout

<sub>Spec 010, <a href="https://github.com/ucfyao/steady/pull/35">PR #35</a></sub>

The agent made Progress's sections panels but left "Your skies" (its own component) as a bare block, and guessed Home's reserved loading space at 136 px for a panel that is 178 px, so the page would still jump. Every test passed: no test looks at layout.

- **Caught by:** Real-browser screenshots of the demo player at 375 px and desktop, and the panel's measured height
- **Fix:** Your skies is a panel (spec updated); the reserved space is 11rem

### 54. Appearance choice

<sub>Spec 012, <a href="https://github.com/ucfyao/steady/pull/37">PR #37</a></sub>

The agent put the three choices in a `role="group"` inside the menu without checking how the menu lays out its items: the group did not stretch them, so the checked dot of a choice sat right after its name instead of at the right edge like the player's. Every test passed.

- **Caught by:** A real-browser screenshot of the open menu, in light and dark
- **Fix:** The group is a column that stretches its items like the menu

### 57. Full-width hero

<sub>Spec 014, <a href="https://github.com/ucfyao/steady/pull/39">PR #39</a></sub>

The agent laid the header's light text on the scene without checking the game variant's dawn sky: at a high dawn "Progress" and the round buttons were light on peach, far below WCAG AA. The same blind spot as #44, one layer up. Every test passed.

- **Caught by:** A real-browser screenshot with `--dawn` at 0.8
- **Fix:** A dark wash behind the header at the top of the scene, and the nav link in the full night text colour

### 58. Full-width hero

<sub>Spec 014, <a href="https://github.com/ucfyao/steady/pull/39">PR #39</a></sub>

The agent's first full-width hero passed every test and its own screenshots at up to 1440 px, but on the developer's 2000 px screen it looked unfinished: a 720 px paper column hanging under a full-width scene, a nearly empty sky, and the text and lantern at opposite corners. The scene had been designed for a small card; the agent enlarged it without redesigning it, and never looked wider than 1440 px.

- **Caught by:** The developer's screenshot at 2000 px
- **Fix:** A centred composition around a larger lantern, one paper background for the whole window, and a richer scene on Home only; screenshots now include 2000 px

### 59. Night look for the check

<sub>Spec 015, <a href="https://github.com/ucfyao/steady/pull/41">PR #41</a></sub>

To lift the page above the fixed scene, the agent gave the header and the content the same `z-index`, so the content, later in the page, painted over the avatar menu that opens from the header. It also kept drawing the background scene under focus mode, which draws its own, so two elements had the `scene` test id and two lantern tests failed.

- **Caught by:** The two failing tests; a real-browser screenshot with the menu open
- **Fix:** The scene layer sits below the page (`z-index: -1`) and the page keeps its own order; the background scene rests while focus mode is on

### 65. Press hint

<sub>Spec 020, <a href="https://github.com/ucfyao/steady/pull/45">PR #45</a></sub>

The agent's first keycap pressed by shrinking its bottom border and adding the same margin, expecting the line to keep its height. It did not: the paragraph around the key changed height by about 1 px through the press, so the text under it twitched on How it works. Every test passed: no test looks at layout.

- **Caught by:** Measuring the paragraph's height every 40 ms for one cycle in a real browser (12 different heights)
- **Fix:** The bottom edge is a shadow and only `transform` and the shadow are animated; the same measurement gives one height

## Product judgement

Choices that passed every check but were wrong for the person using the app. A person playing it or asking why caught them.

### 17. Web: the game

<sub><a href="https://github.com/ucfyao/steady/pull/11">PR #11</a></sub>

The first version of the game passed every test and the scripted browser run, but showed the rules in one line and ran practice at full speed (250 ms digit) from the first trial. The person who played it could not keep up and was not told that pressing on some 3s is normal.

- **Caught by:** A person playing one session before the merge
- **Fix:** Numbered how-to-play steps with an example on the practice and Get ready screens; practice starts at an 800 ms digit and ends at the real speed; the rule stays above the box during practice. The real session's timing is unchanged

### 36. Countdown

<sub><a href="https://github.com/ucfyao/steady/pull/19">PR #19</a>, found in <a href="https://github.com/ucfyao/steady/pull/24">PR #24</a></sub>

The countdown the agent designed counted "3, 2, 1" in the middle of the screen, so the first thing a player saw before the trials was a 3, the very digit they must not press for. The spec and the tests described it, and every check passed.

- **Caught by:** A second walkthrough (screenshots of the countdown)
- **Fix:** A ring that fills, with no number, and a test that no digit is on screen at any point of the countdown

### 37. Results and Progress wording

<sub><a href="https://github.com/ucfyao/steady/pull/24">PR #24</a></sub>

Two inconsistencies that passed every test: the first full session's Results said "It counts as practice" straight after the practice round; and "Digits missed" was a count on Results ("7 · 4 before") but a percentage on Progress (4%).

- **Caught by:** A second walkthrough
- **Fix:** Session 1 is "your first check… not counted" on every page; digits missed is a count everywhere, from the shared metric module, with tests on both pages

### 43. Game points

<sub>Spec 006, <a href="https://github.com/ucfyao/steady/pull/29">PR #29</a></sub>

The agent computed the game points twice: the browser counted them live, and the server stored its own `score.points` (scoring version 4) as "the one that counts". Points are a pure function of the stored trial outcomes, so the stored copy was redundant, and the two counts could differ (a press handled a frame after its trial closed was dropped from the live count).

- **Caught by:** The user asked why there were two sets of points
- **Fix:** No `points` in the score (version stays 3); outcomes come from core's `trialOutcome` everywhere; the page recomputes `pointsSoFar` from its outcomes (a late press replaces its trial's miss), and later screens use the server's `trialOutcomes`

### 46. Personal best

<sub>Spec 007, <a href="https://github.com/ucfyao/steady/pull/31">PR #31</a></sub>

The agent made the personal best the largest points. An all-correct session's points depend on where the 3s fall (3850 to 4190 over the first 100 seeds), so a "New personal best" could come from the sequence rather than the play.

- **Caught by:** An outside review; the range checked with `maxPoints` over seeds 0 to 99
- **Fix:** The personal best is the highest dawn (each sequence tops out at 100%), stated as game progress; a test where more points with a lower dawn is not a best

### 55. Light/dark choice

<sub>Spec 012, <a href="https://github.com/ucfyao/steady/pull/38">PR #38</a></sub>

The agent put the colour scheme under Appearance in the avatar menu, the menu for switching players: hard to find, two clicks, and it read as a per-player setting. The spec, the tests and the screenshots all checked that placement, so none of them could question it.

- **Caught by:** The developer asked why the scheme was not a button of its own, and a UI/UX pass agreed
- **Fix:** A sun/moon button in the header, between Progress and the avatar; Spec 012 §1 revised

## A second code path missed

A change made in one place while the same data also flowed through another: router state, a second map, the end-to-end suite, an old player list.

### 14. Web: Your data page

<sub><a href="https://github.com/ucfyao/steady/pull/10">PR #10</a></sub>

After deleting one player, the page switched to the next player but kept its local state: the delete confirmation stayed open, now reading "Yes, delete everything for Sam", one click from deleting a second player. All unit tests passed.

- **Caught by:** Clicking through the flow in a real (headless) browser
- **Fix:** Every screen is remounted per player (`<Outlet key>`); tests for deletion and for switching with a confirmation open

### 39. Progress chart caption

<sub><a href="https://github.com/ucfyao/steady/pull/24">PR #24</a></sub>

After switching "Digits missed" to a count, the chart caption read "Latest: 0.1": the chart's values came from a separate per-metric map that still passed the raw rate.

- **Caught by:** The new failing test "Latest: 6 (session 11)"
- **Fix:** The map converts with the metric's `show`, like every other place

### 45. Results after a player switch

<sub>Specs 004–005, <a href="https://github.com/ucfyao/steady/pull/31">PR #31</a></sub>

Results showed the session Play handed over in the navigation state whenever its id matched the URL. Switching player remounts the screen but keeps the URL and the state, so the next player saw the previous player's score. The remount rule in CLAUDE.md was followed to the letter, but router state survives it.

- **Caught by:** An outside review, reproduced with a test: Ana's results, switch to Ben, Ana's score stays
- **Fix:** The state carries the player id and is used only for that player; otherwise the current player's history decides; a regression test switches player with the state in place

### 52. Manage players

<sub>Spec 004, <a href="https://github.com/ucfyao/steady/pull/34">PR #34</a></sub>

Looking for everything that used the menu's Add player, the agent searched `src` and `test` but not `apps/web/e2e`, so the Playwright session test still added a player from the menu. Unit tests and `pnpm check` passed.

- **Caught by:** The e2e job in CI timed out on the missing menu item
- **Fix:** The e2e test adds Sam on Manage players and switches in the menu

### 60. Shared player list

<sub>Spec 016, <a href="https://github.com/ucfyao/steady/pull/42">PR #42</a></sub>

Before this change the agent had added a step that read each player's `GET /api/me` and silently ignored a `401`, assuming a removed player would be noticed "when next used". A player that was never selected never was, so players deleted on the server stayed in the menu.

- **Caught by:** The user deleted old data and still saw the players on Manage players
- **Fix:** Replaced by Spec 016: the list comes from the server, so a deleted player is simply not in it

### 61. Shared player list e2e

<sub>Spec 016, <a href="https://github.com/ucfyao/steady/pull/42">PR #42</a></sub>

Moving the list to the server changed what a fresh browser sees (the first player on the server, not a new one), which every end-to-end test assumed. The unit tests passed; only reading the e2e suite against the new rule showed it.

- **Caught by:** Reading `e2e/session.spec.ts` before the e2e run, prompted by `pnpm bootstrap` seeding players in CI
- **Fix:** Each e2e test creates and selects its own uniquely named player through the API

## Git and shell commands

Commands that hid a failure, skipped a check or discarded work. Each led to a standing rule: chain with `&&`, run `pnpm check` before committing, never undo with `git checkout`, check a merge before cleaning up.

### 3. Tooling check

<sub><a href="https://github.com/ucfyao/steady/pull/2">PR #2</a></sub>

To prove lint fails on a bad file, the agent piped the command into `tail` and printed the exit code, which reported the pipe's status (0), not ESLint's.

- **Caught by:** The output showed lint errors next to "exit=0", which cannot both be true
- **Fix:** Re-ran without the pipe: lint and format check both exit 1

### 4. Branch naming

<sub><a href="https://github.com/ucfyao/steady/pull/1">PR #1</a></sub>

The first branch was named `docs/design-note`, against the repository's `feature/` / `fix/` convention.

- **Caught by:** Review of the step afterwards
- **Fix:** Every later branch uses `feature/` or `fix/`

### 8. Commit workflow

<sub><a href="https://github.com/ucfyao/steady/pull/6">PR #6</a></sub>

The agent chained `pnpm check; git commit; git push` with `;`. Check failed (exit 2: the new worktree had no `node_modules`, so a global ESLint ran without the config's plugins), but the commit and push still ran.

- **Caught by:** The command output showed `check=2` above the PR link
- **Fix:** Installed dependencies in the worktree and re-ran check (passes); check and commit are now chained with `&&`, and every new worktree runs `pnpm install` first

### 13. Commit workflow

<sub><a href="https://github.com/ucfyao/steady/pull/9">PR #9</a></sub>

After making `device` required in core, the agent committed core after running only core's tests, typecheck and lint, not `pnpm check`. The API still sent `{}` to start a session, so that commit broke the API tests.

- **Caught by:** Running the API tests before writing the API change: every start-session test failed with 400
- **Fix:** Undid the unpushed commit (`git reset --soft`) and committed core and API together after `pnpm check` passed

### 23. Dev server port

<sub><a href="https://github.com/ucfyao/steady/pull/17">PR #17</a></sub>

Asked to run the web app on 5174 because another session uses 5173, the agent ran `pnpm --filter @steady/web dev -- --port 5174`. pnpm passed a literal `--` to Vite, which ignored the flag and started on 5173 (free at that moment).

- **Caught by:** Checking the listening ports after start-up
- **Fix:** Stopped it within a minute and started `vite --port 5174 --strictPort`; e2e ran through a temporary config on 5174, because the committed config reuses whatever already runs on 5173

### 30. Import link and Home

<sub><a href="https://github.com/ucfyao/steady/pull/20">PR #20</a></sub>

Two slips. Asked to run the web app on another port, the agent used `pnpm --filter @steady/web dev -- --port …` again, the same mistake as #23. And to keep "on 3." together on Home it wrote `\u00a0` inside JSX text, where it is not an escape and would have shown as six literal characters.

- **Caught by:** Vite's "Port 5173 is already in use" error; reading the diff before running the tests
- **Fix:** Started Vite with `--port 5175 --strictPort` and no `--`; used `&nbsp;`, with a Home test that the text contains a non-breaking space

### 33. Mutation check

<sub><a href="https://github.com/ucfyao/steady/pull/22">PR #22</a></sub>

To undo a deliberate break in an uncommitted file, the agent ran `git checkout` on it, which restored `main`'s version and discarded every change it had made to that file in this branch.

- **Caught by:** The agent's own check right after the undo: the file no longer contained `type="linear"`
- **Fix:** The edits were applied again and checked with typecheck, the Progress tests and the end-to-end test; deliberate breaks are now undone from a copy of the file, not from git

### 38. Mutation check

<sub><a href="https://github.com/ucfyao/steady/pull/24">PR #24</a></sub>

The same mistake as #33: to undo deliberate breaks in uncommitted files, the agent ran `git checkout` on them, discarding the branch's changes to three files. Two of the three mutation results were also void, because they ran on the reverted files.

- **Caught by:** The agent's own check: `grep` found the restored marker missing, and `git diff --stat` showed only one changed file
- **Fix:** One file was restored from a backup and two were edited again; the mutations were rerun from copies in the scratchpad, and the work was committed before any further break

### 51. Moving work to a branch

<sub><a href="https://github.com/ucfyao/steady/pull/34">PR #34</a></sub>

To move uncommitted work into a worktree, the agent tried a throwaway "wip" commit with `--no-verify`, skipping the commit hooks against the repository's rules.

- **Caught by:** Claude Code's permission check blocked the command
- **Fix:** Ran `pnpm check` and made a real commit instead

### 67. Merging PR #47

<sub>Spec 022, <a href="https://github.com/ucfyao/steady/pull/47">PR #47</a></sub>

The agent ran the merge and the clean-up in one command with the merge's output hidden. GitHub refused the merge (the branch was behind `main` after #46), but the command went on to delete the worktree and the remote branch, which closed the pull request.

- **Caught by:** The PR's state read OPEN, then CLOSED, right after the command
- **Fix:** The branch was pushed again from the PR's head commit, the PR reopened, updated with `main`, and merged once CI passed; the merge is now checked before any clean-up

## Tooling, runtime and deployment

Problems that local tests could not show: process crashes, stale builds, and assumptions about the hosting platform.

### 9. API database module

<sub><a href="https://github.com/ucfyao/steady/pull/7">PR #7</a></sub>

The `pg.Pool` had no `'error'` listener. When the database dropped idle connections, pg emitted an unhandled `error` event, which crashes a Node process.

- **Caught by:** The new "503 when the database is down" health test: Vitest reported an unhandled `57P01` error although all tests passed
- **Fix:** Added a pool `error` listener that logs; Vitest fails the run on unhandled errors, so the test guards it

### 10. Mutation check

<sub><a href="https://github.com/ucfyao/steady/pull/7">PR #7</a></sub>

A mutation script's search pattern did not match the migration file, so nothing was changed and the run reported the mutation as "survived". A typo in a pattern could equally report a false "caught".

- **Caught by:** The script compares the file before and after applying a mutation and printed "did not apply"
- **Fix:** Retried with a pattern that matched; the unique-constraint mutation is caught

### 35. `pnpm seed:demo`

<sub><a href="https://github.com/ucfyao/steady/pull/20">PR #20</a>, found in <a href="https://github.com/ucfyao/steady/pull/24">PR #24</a></sub>

The seed script compiled the whole API into `apps/api/dist`, the directory `pnpm dev`'s `node --watch` runs from, so every seed (including the one in the import end-to-end test) restarted the API and requests in flight got a 502. CI never saw it, because there the API runs without watch.

- **Caught by:** A second walkthrough: end-to-end tests failed now and then with a 502 while `pnpm dev` was running
- **Fix:** The seed runs from source with `tsx` and writes nothing; `pnpm e2e` with `pnpm dev` running passes with no "Restarting" in the dev log

### 47. Tooling

<sub><a href="https://github.com/ucfyao/steady/pull/31">PR #31</a></sub>

`pnpm dev` did not watch `@steady/core` and `pnpm check` did not build it, so a stale `dist` gave a false typecheck failure (missing `Variant`) and the running API kept old rules. Home also turned a failed load into a silent empty page.

- **Caught by:** An outside review
- **Fix:** `check` builds core first, `dev` runs core's `tsc --watch` (node's `--watch` follows the linked package), CI runs `pnpm build`; Home shows an alert with "Try again"

### 62. Vercel deployment

<sub><a href="https://github.com/ucfyao/steady/pull/23">PR #23</a>, found in <a href="https://github.com/ucfyao/steady/pull/43">PR #43</a></sub>

The API project's build created an empty `public` output directory to satisfy Vercel. Vercel rejects an empty output directory, so the first production build failed. Local checks could not show it.

- **Caught by:** The first Vercel build log: `STATIC_BUILD_EMPTY_OUT_DIR`
- **Fix:** `apps/api/public/robots.txt` (which also keeps crawlers off the API); the build command no longer creates the directory

### 63. Vercel deployment

<sub><a href="https://github.com/ucfyao/steady/pull/23">PR #23</a>, found in <a href="https://github.com/ucfyao/steady/pull/43">PR #43</a></sub>

The web project's rewrite pointed at `steady-api.vercel.app`, assuming the project name would become the domain. That domain belongs to someone else; Vercel gave this project `steady-api-bay.vercel.app`, so the web app would have sent every API call, with players' tokens, to a stranger's app.

- **Caught by:** Listing the API project's domains before deploying the web project
- **Fix:** The rewrite points at the real domain; the deployment doc says to read the domain from the project instead of assuming it

### 64. Vercel deployment

<sub><a href="https://github.com/ucfyao/steady/pull/23">PR #23</a>, found in <a href="https://github.com/ucfyao/steady/pull/43">PR #43</a></sub>

The serverless entry passed every test and an import check, but on Vercel every request failed with `ERR_REQUIRE_ESM`: `@nestjs/throttler` is CommonJS and `require()`s the ES-module-only `@nestjs/common`, which Node 24 allows locally and Vercel's runtime does not.

- **Caught by:** Calling `/api/health` on a preview deployment and reading the function logs
- **Fix:** `NODE_OPTIONS=--experimental-require-module` on the project, documented in docs/deployment.md; verified on a preview (health, a 404 under `/api`, creating a player)

### 66. Scaffold

<sub><a href="https://github.com/ucfyao/steady/pull/2">PR #2</a>, found in <a href="https://github.com/ucfyao/steady/pull/46">PR #46</a></sub>

The scaffold pinned Node 24 (`.nvmrc`, `engines`, `@types/node`) although Node 26 was already the Active LTS; nothing recorded why. Vercel then defaulted the web project to 26, so CI and production would have run different Node versions.

- **Caught by:** Reading the Vercel project settings: the API on 24.x, the web on 26.x
- **Fix:** Node 26 everywhere: `.nvmrc`, `engines`, `@types/node`, a `volta` pin, both Vercel projects; `pnpm check` and e2e run on 26

## Docs and claims

Statements written before they were checked against the code, the design or the data.

### 1. Design note §7–8

<sub><a href="https://github.com/ucfyao/steady/pull/1">PR #1</a></sub>

The note promised a nickname and a "recovery code", and described trial storage as "~130 rows per session". The API design collects no personal data, offers no recovery, and stores a session's trials together with the session.

- **Caught by:** Re-reading the note against the API design before opening the PR
- **Fix:** Reworded both sections to match the design

### 2. PR description

<sub><a href="https://github.com/ucfyao/steady/pull/1">PR #1</a></sub>

The test plan said "all source links resolve" before anyone had checked. One link (the FTC press release) was dead.

- **Caught by:** Running a link check before merging
- **Fix:** Replaced the FTC link; rewrote the test plan to say how each link was checked

### 27. Play flow v2 spec

<sub><a href="https://github.com/ucfyao/steady/pull/19">PR #19</a></sub>

The agent's first spec rewrite numbered the new steps ①②③, the same symbols the design mockup uses for its five screens (①–⑤), so "③" meant "practice result" in the mockup and "before you start" in the spec.

- **Caught by:** Re-reading the spec against the mockup before committing
- **Fix:** The spec names them "Step 1–3", as the step bar does

### 28. Timing check

<sub><a href="https://github.com/ucfyao/steady/pull/19">PR #19</a></sub>

One run per side showed the branch's desktop median 2.7 ms above `main` with one press at 417 ms. Reporting "no change" from that would have been unsupported; reporting a regression would have been wrong too.

- **Caught by:** Comparing with the 375 px pair (identical medians)
- **Fix:** Re-ran desktop alternating `main` and branch on the same servers: medians 406.0 on both. Results recorded with all runs in `tasks.md`

### 34. README data model and API

<sub><a href="https://github.com/ucfyao/steady/pull/25">PR #25</a></sub>

The agent's first draft of the session flow said a bad submission returns `422`. Only implausible timing and an expired session do; responses that do not match the stored trials return `400`.

- **Caught by:** Reading `sessions.service.ts` against the draft before committing
- **Fix:** The flow names both codes and when each applies

### 50. Your data copy

<sub>Spec 004, <a href="https://github.com/ucfyao/steady/pull/34">PR #34</a></sub>

The agent proposed "clear this browser's data and your history is gone for good". The sessions stay in the database; only the key to them is lost, so the history is unreachable, not deleted.

- **Caught by:** The developer asked why the history would be gone when it is stored in the database
- **Fix:** The page says this browser holds the keys, so clearing it loses access to the history

## Adding an entry

Use the next number and put it under the matching kind of mistake (add a kind if none fits, and a row in the summary). Write what was wrong, how it was caught and the fix, each in plain words, and name the pull request or spec in the heading.

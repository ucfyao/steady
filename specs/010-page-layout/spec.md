# Spec 010: Page layout, panels and consistent states

Status: implemented
Design note: `docs/design-note.md` §3
Depends on: Spec 004, Spec 007, Spec 009
Changes: Spec 004 (screen titles, Card, waiting and error states, "Before you start", Progress), Spec 007 (the night colours become tokens)

## Why

A UI/UX review of every screen outside focus mode (2026-11-17) found three problems with how the pages look and behave. Nothing here changes a measurement, a comparison or a score.

1. **Titles that say nothing.** Every screen opens with a 36–44 px serif title ("Progress", "Session complete") that repeats the header's navigation or the obvious. It takes the top of the screen, and the sentence that actually says something (the conclusion, the summary) sits under it in grey.
2. **Pages made of rules.** `Card` is only a top border with a 13 px grey heading, and Progress adds more sections with the same top border. The hierarchy jumps from a very large title straight to small grey labels, and a long page reads as one ruled document with no groups. Home's night hero then looks like another product.
3. **Every screen waits and fails differently.** Play has a centred waiting state; Results and Progress show a bare "Loading…"; Home shows nothing and then pushes its panels in. Errors show the raw error text (`Failed to fetch`, `Request failed (500)`), Progress's error has no way forward, and Import has its own error layout.

The review also found smaller issues, which are fixed here as well: a "Skip" that starts the session, colours and font weights outside the tokens, a heading inside a `<summary>`, and sample sizes that only a mouse can see.

## 1. Screen titles

- **A screen's name is not shown when the header or its first sentence already says it.** It stays in the DOM as the screen's `h1` with the `visually-hidden` class, so screen readers and heading navigation still find it.
- In its place, the **first visible line is the screen's main sentence**, in a new `headline` style: the serif face, 22 px on a phone and 28 px from 640 px, in the text colour (not muted), with `text-wrap: pretty`.

| Screen   | `h1` (hidden)      | First visible line                                                                                                                                      |
| -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Progress | "Progress"         | The summary (Spec 004), or with no sessions, "No sessions yet. Your progress appears here after your first check."                                      |
| Results  | "Session complete" | The conclusion (Spec 004). Until the history has loaded, or if it fails, "Session complete." so the line is never blank. It stays `aria-live="polite"`. |

- **Titles that are the content stay visible**, at the new `h1` size (below): Home's "Hi, {name}" in the hero (which keeps its own larger size), Play's "Catch every digit. Hold back on 3." and "How are you today?", every status page ("Page not found", "Session stopped", …) and **Players**. Players is reached only from the avatar menu, so nothing else on the screen names it, and its title carries Add a player.
- **The default `h1` is 28 px** (`--text-2xl`) instead of 36–44 px. Only Home's hero greeting keeps the larger size.
- Play's first title wraps with `text-wrap: balance` instead of a forced line break, so it never leaves one word on a line of its own.

## 2. Sections are panels

- **`Card` becomes a panel:** a 1 px border in `--color-border`, `--radius-md` corners and `--space-5` padding (`--space-4` below 540 px), on the content surface. Panels are `--space-4` apart.
- **No tinted fill.** The muted text (`#6e695e`) is 4.35:1 on `--color-surface-sunken` (below WCAG AA) and 4.89:1 on the surface, so panels keep the surface and are grouped by their border.
- **The panel heading** is 16 px (`--text-base`), sans, medium weight, in the text colour, instead of 13 px muted.
- **One kind of section on every screen.** Progress's "Your skies", "Over time", "Your sessions" and "Exploring patterns", which are now top-ruled or bare blocks, become panels. Inside "Exploring patterns", its two parts are separated by a rule, not nested in another bordered box.
- Unchanged: Home's night hero, the game panel on Results (its night gradient, no border) and the Players list.

## 3. Waiting and error states

- **Waiting** always uses the shared `Loading` (centred, breathing ring, a status):
  - Results: "Loading your results…"
  - Progress: "Loading your progress…"
  - Import: "Checking the link…"
- **Home reserves the space** of its panels while the history loads: one empty panel of the height of "Last 7 days", marked `aria-busy="true"`, so nothing pushes the page down when the data arrives.
- **Error text is plain words**, chosen by the client error's kind, never the raw message:
  - network: "Could not reach Steady. Check your connection and try again."
  - anything else: "Something went wrong on our side. Try again in a moment."
  - The import link keeps its own specific sentences (Spec 004).
- **A screen that cannot load is a status page** (Spec 004's `StatusPage`) with **Try again** (loads the screen again) and **Back to home**:
  - Results: "Could not load this session"
  - Progress: "Could not load your progress"
  - Play, before the start: "Could not get the check ready"
  - Import: "Couldn't import this player" (Back to home only, as now; the link cannot be retried from here)
- Home keeps its inline error with Try again under the hero, because the hero and its Start button still work without the history.
- Play's submit error keeps its rule (Try again when it can be retried, otherwise Back to home) with the plain words above; a session the server refuses (`409`, `422`) reads "This session could not be saved."

## 4. "Before you start"

- **"Skip" becomes "Skip and start".** It clears the check-in and starts the session at once; the old word read as "skip this page". "How to play" is unchanged.

## 5. Tokens and fonts

- **The night colours are tokens** in `src/styles/tokens.css`, used by Home's hero, the Results game panel and the focus screen instead of literal values: `--night-bg` (`#1b2340`), `--night-text` (`#ece6da`), `--night-muted` (`rgb(236 230 218 / 0.7)`), `--lantern` (`#ffd696`), `--lantern-hover` (`#ffe2a0`) and `--on-lantern` (`#2b2925`). The scene is dark in both colour schemes, so they are not redefined for dark mode. The values do not change.
- **Every weight that is used is loaded:** Inter 600 (`--font-weight-semibold`: the new-best pill, the multiplier, practice feedback, the step bar, `kbd`) and Fraunces 500 (the digit in calm and game) are added to the font link. Nothing falls back to a neighbouring weight.

## 6. Accessibility

- **"Exploring patterns"**: the `h2` and its note sit outside the `<summary>`. A `<summary>` is a button, and some screen readers drop the heading inside it. The summary reads "Show the patterns" when closed and "Hide the patterns" when open, with the turning chevron as now.
- **Recent vs. where you started**: each median shows how many sessions it is the median of ("of 5") in small muted text under the number, instead of a `title` that only a mouse can show.

## 7. Tests

- Progress and Results: the screen's `h1` exists with `visually-hidden`, and the first visible text is the summary or the conclusion; Results shows "Session complete." before the history arrives and when it fails.
- Waiting: Results, Progress and Import show the shared status ("Loading your results…" and so on); Home shows the reserved panel with `aria-busy` and then the history.
- Errors: a network error and a server error each show their plain sentence and never the raw message; Results, Progress and Play show their status page, and Try again loads the screen again; Import's error is a status page.
- "Skip and start" starts the session without a check-in.
- "Exploring patterns": the heading is not inside the summary, and the summary's words follow the open state.
- The recent table shows each median's count as text.

## 8. Out of scope

- Home's first-time copy (the hero still says "Start today's check" above the welcome panel).
- The layout of Results' five number tiles.
- The header, the avatar menu and the Players page beyond its title size.

# Plan: Spec 014

- `apps/web/src/Layout.tsx`: on `/` (React Router's `useMatch`), with the players ready and no notice, the app root gets `data-over-hero` and the header the `overHero` class.
- `apps/web/src/Layout.module.css`: `.app` is `position: relative`; `.overHero` takes the header out of the flow (absolute, over the top of the column, above the scene) and sets the night colours on the brand, link and two round buttons only, so the avatar menu keeps the surface colours.
- `apps/web/src/screens/Home.module.css`: `.hero` breaks out of the column (`width: 100vw; margin-inline: calc(50% - 50vw)`), has no radius and a viewport-based height, centred content; `:global([data-over-hero]) .hero` adds the header's height to its top padding. An inner `.heroInner` keeps the lantern and text on the column. The lantern becomes a few spans styled in CSS, in the flow above the greeting. Home also sets `--dawn` on the hero, so its text wash follows the dawn.
- `apps/web/src/styles/tokens.css`: `body { overflow-x: clip }`, so `100vw` never makes a horizontal scroll bar; the body's background is `--color-surface`, and `.app` loses its own background.
- `apps/web/src/game/Scene.tsx`: an optional `rich` prop (more stars with a per-star `--alpha`, a distant hill path, a horizon glow); Home passes it, focus mode does not.
- `apps/web/src/screens/Home.tsx`: the hero's inner column and lantern markup; `Welcome` without `Card`.
- No core or API change.

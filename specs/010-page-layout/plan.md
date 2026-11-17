# Plan: Spec 010

- `apps/web/src/styles/tokens.css`: `h1` at `--text-2xl`; a global `.headline` class next to `.visually-hidden`; the `--night-*` and `--lantern*` tokens.
- `apps/web/index.html`: add Inter 600 and Fraunces 500 to the Google Fonts link.
- `apps/web/src/ui/Card.module.css`: border, radius and padding; the heading at `--text-base` in the text colour.
- `apps/web/src/api/client.ts`: `errorWords(e)`, the plain sentence for an error by its kind (network, refused, other), shared by every screen.
- `apps/web/src/screens/Progress.tsx` and `.module.css`: hidden `h1`, summary as `.headline`, `Loading`, `StatusPage` with Try again (an `attempt` counter as on Home); "Over time", "Your sessions" and "Exploring patterns" as `Card`; the heading out of the `<summary>`; the count under each median; drop `.block` and the bordered `.part`.
- `apps/web/src/screens/Results.tsx` and `.module.css`: hidden `h1`, conclusion as `.headline` with "Session complete." as its fallback, `Loading`, `StatusPage` with Try again.
- `apps/web/src/screens/Home.tsx` and `.module.css`: the reserved `aria-busy` panel while loading; the hero's `h1` keeps `--text-4xl`; night tokens instead of literals.
- `apps/web/src/screens/Play.tsx` and `.module.css`: "Skip and start"; `text-wrap: balance` instead of `<br />`; load and submit errors through `errorWords`, the load error as a `StatusPage`.
- `apps/web/src/screens/Import.tsx`: `Loading` while checking; the error as a `StatusPage`.
- `apps/web/src/game/Block.module.css`, `Results.module.css`: night tokens instead of literals (same values).
- No core or API change; scoring version unchanged.

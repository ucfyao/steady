# Plan: Spec 015

- `apps/web/src/Layout.tsx`: the outlet context gains `setNight`; a new `useNightPage(on)` hook (a layout effect, like `useFocusMode`, so the look is set before the first paint and cleared on unmount). While on, the app root gets `data-night` and the layout draws `Scene` in a fixed layer behind everything.
- `apps/web/src/Layout.module.css`: the fixed scene layer, the app above it.
- `apps/web/src/styles/tokens.css`: the night token set under `[data-night]` (a separate palette, not a copy of the dark set).
- `apps/web/src/screens/Play.tsx`: remember when the variant is known; `useNightPage(known && variant !== 'plain')`.
- No core or API change.

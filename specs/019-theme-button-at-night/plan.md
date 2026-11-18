# Plan: Spec 019

- `apps/web/src/Layout.tsx`: render `ThemeToggle` only while the night look is off (`night` is already the layout's state, set by `useNightPage`).
- `apps/web/test/night-play.test.tsx`: the button's presence per group, and after leaving.
- `specs/012-theme-toggle/spec.md`: a note that Spec 019 changes where the button is.
- No core or API change.

# Plan: Spec 012

- `apps/web/src/theme/theme.ts`: `Theme = 'system' | 'light' | 'dark'`, `THEME_KEY`, `readTheme(storage)` (unknown or failing storage → `system`), `saveTheme(storage, theme)` (never throws; `system` removes the key) and `applyTheme(root, theme)`.
- `apps/web/src/theme/boot.ts`: the pre-paint script as a string built from `THEME_KEY` and the allowed values; a Vite plugin in `vite.config.ts` injects it into `index.html`, so the key and values come from one place.
- `apps/web/src/styles/tokens.css`: the dark set under `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }` and again under `:root[data-theme='dark']`.
- `apps/web/src/PlayerMenu.tsx` and `Layout.module.css`: the Appearance group (a `role="group"` with a small label) after Manage players; choosing applies, saves, closes and refocuses.
- No core or API change.

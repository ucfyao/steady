# Plan: Spec 012

- `apps/web/src/theme/theme.ts`: `Theme = 'system' | 'light' | 'dark'`, `THEME_KEY`, `readTheme(storage)` (unknown or failing storage → `system`), `saveTheme(storage, theme)` (never throws; `system` removes the key) and `applyTheme(root, theme)`.
- `apps/web/src/theme/boot.ts`: the pre-paint script as a string built from `THEME_KEY` and the allowed values; a Vite plugin in `vite.config.ts` injects it into `index.html`, so the key and values come from one place.
- `apps/web/src/styles/tokens.css`: the dark set under `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }` and again under `:root[data-theme='dark']`.
- `apps/web/src/theme/ThemeToggle.tsx`: the header button. It keeps the stored choice in state, follows `matchMedia('(prefers-color-scheme: dark)')` (and its `change` event) while nothing is stored, and on click applies and saves the opposite of what is shown. `Layout.tsx` puts it between the nav and the avatar; `Layout.module.css` gives it the avatar's look with a 44 px tap area. The Appearance group leaves `PlayerMenu.tsx`.
- No core or API change.

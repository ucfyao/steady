# Plan: Spec 019

- `apps/web/src/styles/tokens.css`: `:root` takes the night-blue values (Spec 017) and `color-scheme: dark`; the `prefers-color-scheme` block and `[data-theme='dark']` go.
- `apps/web/src/game/Block.module.css`: plain's focus screen no longer resets `color-scheme`.
- Removed: `apps/web/src/theme/` (button, storage, boot script), the Vite plugin that injected the script, the button's styles in `Layout.module.css`, `apps/web/test/theme.test.tsx`.
- `apps/web/test/night-only.test.tsx`: no button; a stored choice sets nothing.
- Docs: Spec 012 marked replaced; Spec 017 notes it is the only set; comments that mention the system theme.
- No core or API change.

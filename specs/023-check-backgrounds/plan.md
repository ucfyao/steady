# Plan: Spec 023

- `apps/web/src/Layout.tsx`:
  - replace the night page (`night`, `useNightPage`) with a check scene: `useCheckScene(dawn)`, where `dawn` is a number for calm and game and `null` for plain or while loading. While set, the layout draws Home's scene (`Scene` with `rich`) fixed behind the window with `--dawn`, and the header lies on it (the existing over-hero style).
  - always render `ThemeToggle` in the header (drop the Spec 019 condition).
  - `data-night` is no longer set; its token block in `styles/tokens.css` and the `.nightScene` styles go if nothing else uses them.
- `apps/web/src/screens/Play.tsx`: compute the last game sky from the sessions it already loads (`dawnPercent` of the last `game` session, as on Home), and call `useCheckScene(variant === 'plain' ? null : dawn)` once the variant is known. Wrap the content of the screens outside focus mode in a panel while the scene is on.
- `apps/web/src/screens/Play.module.css` (or `Layout.module.css`): the panel on the theme's surface, border and radius; the fixed scene layer below the page.
- Tests: rewrite `apps/web/test/night-play.test.tsx` for Spec 023 (header, scene per group, dawn, theme click, loading, switching players); keep the focus-mode tests as they are.
- Docs: Spec 015 and Spec 019 status lines point to Spec 023; `docs/design-note.md` §3 if it describes the night look of the check.
- No core or API change.

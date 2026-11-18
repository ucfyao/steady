# Plan: Spec 028

- `apps/web/src/Layout.tsx`:
  - rename `useCheckScene(dawn)` to `useScene(dawn)`; the scene layer's test id becomes `page-scene`.
  - remove `useOverHero`, the `overHero` header and `data-over-hero`: the header takes the `onScene` style whenever a scene is drawn.
  - set `data-scene` on the layout while a scene is drawn, for the panels.
- `apps/web/src/Layout.module.css`: drop `.overHero`.
- `apps/web/src/screens/Home.tsx` and `.module.css`: read the group from `usePlayers().groups`; call `useScene` for calm and game; no `Scene` inside the hero; the lantern only on the scene; the hero is a plain column, with the night colours, the wash and the lantern's button colours only on the scene; the welcome and the starting-point line get a panel on the scene.
- `apps/web/src/screens/Results.tsx` and `.module.css`: `useScene` with the session's dawn for calm and game sessions, none for plain; no `Scene` inside the band; the night colours and the wash only on the scene; the secondary button in the night colours on the scene.
- `apps/web/src/screens/Play.tsx`: use the renamed hook. `Play.module.css`: the panel's shadow.
- `apps/web/src/ui/Card.module.css`: the surface fill and the shadow under `[data-scene]`.
- `apps/web/src/styles/tokens.css`: one `--shadow-on-scene` token.
- Tests: `full-bleed-hero.test.tsx` becomes the Home part of Spec 028; the Spec 018 block in `results.test.tsx` and the `check-scene` id in `check-backgrounds.test.tsx` follow the new rule; `lantern.test.tsx` if it expects the lantern for every group.
- Docs: status lines of Spec 014, 018 and 026; design note §3 if it describes the band.
- No core or API change.

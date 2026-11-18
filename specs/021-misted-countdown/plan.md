# Plan: Spec 021

- `apps/web/src/game/Block.tsx`: the frost element starts with `data-on="true"`; the first `draw` of a digit clears it, as before. React never rewrites the attribute (its value never changes), so it stays until the block writes it.
- `apps/web/test/lantern.test.tsx`: misted through the countdown and cleared at the first digit, for calm and game.
- No core or API change.

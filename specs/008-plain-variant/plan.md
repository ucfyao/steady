# Plan: Spec 008

- `packages/core/src/types.ts`: `VARIANTS = ['plain', 'calm', 'game']`. The contracts and the API's random assignment already read `VARIANTS`, so they follow. `variant` is a `text` column: no migration.
- `apps/web/src/game/Block.tsx`: with `variant === 'plain'`, render the bare stimulus on the stage (no `Scene`, fireflies, lantern or frost) and draw `⊗` as the mask; the trial loop and the runner are unchanged.
- `apps/web/src/game/Block.module.css`: a `.plain` modifier on `.focus` with the paper tokens and the pre-Spec-006 digit size and face.
- Home, Results and Progress check `variant === 'game'` already, so plain is as calm there.
- No score change: scoring version stays 3.

# Plan: Spec 009

- `apps/web/src/game/Block.tsx`: `onVoid(reason: 'left' | 'stopped')`; a Stop button outside the stage (so it is never in the tap area) and Escape in the key handler both call the same stop, which ends the frame loop like leaving the page does.
- `apps/web/src/game/Block.module.css`: `.stop`, top-right, above the probe overlay, in the scene's and the plain variant's colours.
- `apps/web/src/screens/Play.tsx`: the `voided` step keeps the reason and words the status page by it.
- No core or API change.

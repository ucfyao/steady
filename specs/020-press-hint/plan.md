# Plan: Spec 020

- `apps/web/src/game/Key.tsx` + `Key.module.css`: the keycap (`<kbd>`), `moving` sets `data-moving`; the press keyframes apply only under `[data-moving='true']`. Colours only from tokens.
- `apps/web/src/game/HowToPlay.tsx`: the rule uses `Key` (moving) for "Space" or "Tap"; its own `.key` style goes.
- `apps/web/src/game/Block.tsx`: `hint` becomes a `ReactNode`; the rule line gets `data-testid="hint"`; the countdown's "Finger on …" uses `Key`, moving while the word is not "Go".
- `apps/web/src/screens/Play.tsx`: the rule line built with a still `Key`.
- Tests: `apps/web/test/press-hint.test.tsx`; `play.test.tsx` reads the rule line from its test id (its text now spans the key).
- No core or API change; no scoring change.

# Plan: Spec 027

- `packages/core/src/contracts.ts`: drop `variant` from `StartSessionSchema`.
- `apps/api/src/sessions/`: `start` takes no override; the variant is always the player's.
- `apps/web/src/game/env.ts`: drop `variantOverride`, `parseVariant` and the startup read.
- `apps/web/src/screens/Play.tsx`: the variant is `me.variant`; `startSession` sends no variant.
- Tests: remove the override tests (web, API) and the fake env's override parameter; add the core and API cases from the spec.
- Status lines of Specs 006, 008, 011, 015 and 026 point to Spec 027.

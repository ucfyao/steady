-- Spec 006 §5: the A/B group. Existing players are put in a group at random (a volatile
-- default is evaluated per row); new players get one from the API. Existing sessions were
-- played before the game layer existed, so they are recorded as calm.
ALTER TABLE "players" ADD COLUMN "variant" text NOT NULL DEFAULT (CASE WHEN random() < 0.5 THEN 'calm' ELSE 'game' END);--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "variant" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "variant" text NOT NULL DEFAULT 'calm';--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "variant" DROP DEFAULT;

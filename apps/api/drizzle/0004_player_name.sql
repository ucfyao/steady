-- Spec 013: the player's name is stored with the player. Existing players get "Player" (old
-- data is not carried over; a local setup is refreshed by pnpm seed:demo); new players always
-- send a name, so the default is dropped again.
ALTER TABLE "players" ADD COLUMN "name" text NOT NULL DEFAULT 'Player';--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "name" DROP DEFAULT;

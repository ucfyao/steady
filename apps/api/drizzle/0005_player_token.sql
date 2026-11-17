-- Spec 014: the token in plain text, so GET /api/players can hand it out. Lookups still use
-- token_hash. Players made before this have none and are not listed.
ALTER TABLE "players" ADD COLUMN "token" text;

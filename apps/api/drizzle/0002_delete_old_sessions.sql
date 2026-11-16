-- Spec 005: sessions now have 81 trials. Older 126-trial sessions do not compare with them
-- (a different number of 3s, digits and probes), so they are deleted. Players are kept.
DELETE FROM "sessions" WHERE jsonb_array_length("trials") <> 81;

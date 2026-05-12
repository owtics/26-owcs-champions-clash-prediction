-- Migration: add unique constraint to User.nickname
-- Safe approach: fix empty/duplicate nicknames first, then add constraint.

-- Step 1: Replace empty nicknames with the user's username (safe fallback).
UPDATE "User" SET nickname = username WHERE nickname = '' OR nickname IS NULL;

-- Step 2: For any remaining duplicates (edge case), append a short id suffix.
UPDATE "User" u1
SET nickname = u1.username || '_' || SUBSTRING(u1.id, 1, 4)
WHERE (
  SELECT COUNT(*) FROM "User" u2
  WHERE u2.nickname = u1.nickname AND u2.id != u1.id
) > 0;

-- Step 3: Add the unique index.
CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");

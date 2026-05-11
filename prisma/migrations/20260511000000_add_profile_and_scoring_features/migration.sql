-- Add nickname and avatarUrl to User model
ALTER TABLE "User" ADD COLUMN "nickname" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;

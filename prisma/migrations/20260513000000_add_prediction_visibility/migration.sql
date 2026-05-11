-- AlterTable: add isPredictionPublic field to User
ALTER TABLE "User" ADD COLUMN "isPredictionPublic" BOOLEAN NOT NULL DEFAULT true;

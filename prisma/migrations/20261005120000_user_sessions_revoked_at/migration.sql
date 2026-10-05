-- Sessions signed in before this moment are no longer valid. Set when an admin resets
-- a password; NULL (the default for every existing row) means nothing is revoked.
ALTER TABLE "User" ADD COLUMN "sessionsRevokedAt" DATETIME;

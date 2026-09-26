-- Participant News engagement: last visit to /dashboard/news for new-post badge.
ALTER TABLE "ParticipantProfile" ADD COLUMN "newsLastViewedAt" DATETIME;

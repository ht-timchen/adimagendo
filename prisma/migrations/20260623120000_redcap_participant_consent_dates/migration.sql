-- AlterTable
ALTER TABLE "redcap_participant_sync" ADD COLUMN "participantConsentDate" DATETIME;
ALTER TABLE "redcap_participant_sync" ADD COLUMN "parentConsentDate" DATETIME;

-- Existing enrollmentDate rows were participant consent datetimes; backfill for display until re-sync.
UPDATE "redcap_participant_sync"
SET "participantConsentDate" = "enrollmentDate"
WHERE "participantConsentDate" IS NULL AND "enrollmentDate" IS NOT NULL;

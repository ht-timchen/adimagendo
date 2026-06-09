-- Participant data classification (Phase 1): dataSource + dataKind on profiles and REDCap sync.

-- ParticipantProfile: default LOCAL + TEST for rows without studyRecordId.
ALTER TABLE "ParticipantProfile" ADD COLUMN "dataSource" TEXT NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "ParticipantProfile" ADD COLUMN "dataKind" TEXT NOT NULL DEFAULT 'TEST';

-- REDCap-linked profiles: REDCAP + UNKNOWN.
UPDATE "ParticipantProfile"
SET "dataSource" = 'REDCAP', "dataKind" = 'UNKNOWN'
WHERE "studyRecordId" IS NOT NULL AND trim("studyRecordId") != '';

-- Known dummy REDCap record ids (e.g. TEST001).
UPDATE "ParticipantProfile"
SET "dataSource" = 'REDCAP', "dataKind" = 'TEST'
WHERE "studyRecordId" IS NOT NULL
  AND upper(trim("studyRecordId")) LIKE 'TEST%';

-- RedcapParticipantSync roster classification.
ALTER TABLE "redcap_participant_sync" ADD COLUMN "dataKind" TEXT NOT NULL DEFAULT 'UNKNOWN';

UPDATE "redcap_participant_sync"
SET "dataKind" = 'TEST'
WHERE upper(trim("studyRecordId")) LIKE 'TEST%';

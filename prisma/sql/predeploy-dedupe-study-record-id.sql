-- Clear duplicate studyRecordId values (keep earliest profile per record) so the
-- unique index can be applied safely on existing Railway / SQLite volumes.
UPDATE "ParticipantProfile"
SET "studyRecordId" = NULL
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "studyRecordId"
        ORDER BY "createdAt" ASC
      ) AS rn
    FROM "ParticipantProfile"
    WHERE "studyRecordId" IS NOT NULL AND trim("studyRecordId") != ''
  ) AS ranked
  WHERE rn > 1
);

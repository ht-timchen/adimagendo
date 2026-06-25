-- Deduplicate before adding unique constraint on studyRecordId.
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

-- Prisma @@unique([studyRecordId]) on ParticipantProfile
CREATE UNIQUE INDEX "ParticipantProfile_studyRecordId_key" ON "ParticipantProfile"("studyRecordId");

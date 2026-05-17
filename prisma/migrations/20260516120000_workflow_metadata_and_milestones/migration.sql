-- Extend ChecklistTemplate with workflow metadata
-- Add StudyMilestone and ParticipantMilestone

-- CreateTable
CREATE TABLE "StudyMilestone" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "requiredKeys" JSON NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ParticipantMilestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "milestoneKey" TEXT NOT NULL,
    "achievedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParticipantMilestone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParticipantMilestone_milestoneKey_fkey" FOREIGN KEY ("milestoneKey") REFERENCES "StudyMilestone" ("key") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChecklistTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "externalUrl" TEXT,
    "dueOffsetDays" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "surveyTemplateKey" TEXT,
    "redcapUrl" TEXT,
    "prerequisiteKeys" JSON,
    "unlockOffsetDays" INTEGER,
    "completionGroupKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistTemplate_surveyTemplateKey_fkey" FOREIGN KEY ("surveyTemplateKey") REFERENCES "SurveyTemplate" ("key") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ChecklistTemplate" ("createdAt", "description", "dueOffsetDays", "externalUrl", "id", "key", "sortOrder", "title", "type", "updatedAt") SELECT "createdAt", "description", "dueOffsetDays", "externalUrl", "id", "key", "sortOrder", "title", "type", "updatedAt" FROM "ChecklistTemplate";
DROP TABLE "ChecklistTemplate";
ALTER TABLE "new_ChecklistTemplate" RENAME TO "ChecklistTemplate";
CREATE UNIQUE INDEX "ChecklistTemplate_key_key" ON "ChecklistTemplate"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ParticipantMilestone_userId_idx" ON "ParticipantMilestone"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantMilestone_userId_milestoneKey_key" ON "ParticipantMilestone"("userId", "milestoneKey");

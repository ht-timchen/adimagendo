-- AlterTable
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
    "requiredMilestoneKeys" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistTemplate_surveyTemplateKey_fkey" FOREIGN KEY ("surveyTemplateKey") REFERENCES "SurveyTemplate" ("key") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ChecklistTemplate" ("id", "key", "title", "description", "type", "externalUrl", "dueOffsetDays", "sortOrder", "surveyTemplateKey", "redcapUrl", "prerequisiteKeys", "unlockOffsetDays", "completionGroupKey", "createdAt", "updatedAt") SELECT "id", "key", "title", "description", "type", "externalUrl", "dueOffsetDays", "sortOrder", "surveyTemplateKey", "redcapUrl", "prerequisiteKeys", "unlockOffsetDays", "completionGroupKey", "createdAt", "updatedAt" FROM "ChecklistTemplate";
DROP TABLE "ChecklistTemplate";
ALTER TABLE "new_ChecklistTemplate" RENAME TO "ChecklistTemplate";
CREATE UNIQUE INDEX "ChecklistTemplate_key_key" ON "ChecklistTemplate"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

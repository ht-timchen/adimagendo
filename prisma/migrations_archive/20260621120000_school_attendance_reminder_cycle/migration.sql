-- CreateTable
CREATE TABLE "SchoolAttendanceReminderCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cycleStartAt" DATETIME NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'AWAITING_RESPONSE',
    "stage" TEXT NOT NULL DEFAULT 'INITIAL',
    "initialDueAt" DATETIME NOT NULL,
    "firstFollowUpDueAt" DATETIME NOT NULL,
    "secondFollowUpDueAt" DATETIME NOT NULL,
    "dismissedAt" DATETIME,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolAttendanceReminderCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SchoolAttendanceReminderCycle_userId_outcome_idx" ON "SchoolAttendanceReminderCycle"("userId", "outcome");

-- CreateIndex
CREATE INDEX "SchoolAttendanceReminderCycle_userId_cycleStartAt_idx" ON "SchoolAttendanceReminderCycle"("userId", "cycleStartAt");

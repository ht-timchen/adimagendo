-- Unified ReminderCycle. Cycle start is reminder1At.
-- School periodKey is school:YYYY-MM-DD of the Adelaide R1 Friday.
-- Existing Friday 17:00 instants are copied as stored; new cycles use 16:30.

CREATE TABLE "ReminderCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "scheduleVersion" INTEGER NOT NULL,
    "reminder1At" DATETIME NOT NULL,
    "reminder2At" DATETIME NOT NULL,
    "reminder3At" DATETIME NOT NULL,
    "cycleEndAt" DATETIME NOT NULL,
    "push1SentAt" DATETIME,
    "push2SentAt" DATETIME,
    "push3SentAt" DATETIME,
    "dismissedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "response" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReminderCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "ReminderCycle" (
    "id",
    "userId",
    "reminderType",
    "periodKey",
    "scheduleVersion",
    "reminder1At",
    "reminder2At",
    "reminder3At",
    "cycleEndAt",
    "push1SentAt",
    "push2SentAt",
    "push3SentAt",
    "dismissedAt",
    "status",
    "response",
    "completedAt",
    "createdAt"
)
SELECT
    "id",
    "userId",
    "reminderType",
    "periodKey",
    "scheduleVersion",
    "reminder1At",
    "reminder2At",
    "reminder3At",
    "cycleEndAt",
    NULL,
    NULL,
    NULL,
    "dismissedAt",
    "status",
    "response",
    "completedAt",
    "createdAt"
FROM (
    SELECT
        src.*,
        -- Prefer a real YES/NO over a later duplicate pending/expired row.
        -- Among answers, keep the latest completedAt. With no answer, keep
        -- expired_missed over a later pending duplicate, then the latest row.
        ROW_NUMBER() OVER (
            PARTITION BY "userId", "reminderType", "periodKey"
            ORDER BY
                CASE WHEN "response" IN ('YES', 'NO') THEN 0 ELSE 1 END,
                CASE WHEN "status" = 'expired_missed' THEN 0 ELSE 1 END,
                CASE
                    WHEN typeof("completedAt") = 'integer' THEN "completedAt"
                    WHEN "completedAt" IS NULL THEN 0
                    ELSE CAST(strftime('%s', "completedAt") AS INTEGER)
                END DESC,
                CASE
                    WHEN typeof("updatedAt") = 'integer' THEN "updatedAt"
                    ELSE CAST(strftime('%s', "updatedAt") AS INTEGER)
                END DESC,
                "id" DESC
        ) AS "rn"
    FROM (
        SELECT
            "id",
            "userId",
            'school_attendance' AS "reminderType",
            'school:' || CASE
                WHEN typeof("initialDueAt") = 'integer' THEN strftime('%Y-%m-%d', "initialDueAt" / 1000, 'unixepoch')
                ELSE strftime('%Y-%m-%d', "initialDueAt")
            END AS "periodKey",
            1 AS "scheduleVersion",
            "initialDueAt" AS "reminder1At",
            "firstFollowUpDueAt" AS "reminder2At",
            "secondFollowUpDueAt" AS "reminder3At",
            CASE
                WHEN typeof("secondFollowUpDueAt") = 'integer' THEN "secondFollowUpDueAt" + 32400000
                ELSE datetime("secondFollowUpDueAt", '+9 hours')
            END AS "cycleEndAt",
            "dismissedAt",
            CASE "outcome"
                WHEN 'AWAITING_RESPONSE' THEN 'pending'
                WHEN 'EXPIRED_NO_RESPONSE' THEN 'expired_missed'
                ELSE 'completed'
            END AS "status",
            CASE
                WHEN "outcome" IN ('RESPONDED_YES_CONFIRMED', 'RESPONDED_YES_ROUTED') THEN 'YES'
                WHEN "outcome" = 'RESPONDED_NO' THEN 'NO'
                ELSE NULL
            END AS "response",
            CASE
                WHEN "outcome" IN ('RESPONDED_YES_CONFIRMED', 'RESPONDED_YES_ROUTED', 'RESPONDED_NO') THEN "respondedAt"
                ELSE NULL
            END AS "completedAt",
            "createdAt",
            "updatedAt"
        FROM "SchoolAttendanceReminderCycle"
        UNION ALL
        SELECT
            "id",
            "userId",
            'medical_appointments' AS "reminderType",
            'medical:' || CASE
                WHEN typeof("initialDueAt") = 'integer' THEN strftime('%Y-%m', "initialDueAt" / 1000, 'unixepoch')
                ELSE strftime('%Y-%m', "initialDueAt")
            END AS "periodKey",
            1 AS "scheduleVersion",
            "initialDueAt" AS "reminder1At",
            "firstFollowUpDueAt" AS "reminder2At",
            "secondFollowUpDueAt" AS "reminder3At",
            CASE
                WHEN typeof("secondFollowUpDueAt") = 'integer' THEN "secondFollowUpDueAt" + 25200000
                ELSE datetime("secondFollowUpDueAt", '+7 hours')
            END AS "cycleEndAt",
            "dismissedAt",
            CASE "outcome"
                WHEN 'AWAITING_RESPONSE' THEN 'pending'
                WHEN 'EXPIRED_NO_RESPONSE' THEN 'expired_missed'
                ELSE 'completed'
            END AS "status",
            CASE
                WHEN "outcome" = 'RESPONDED_YES_CONFIRMED' THEN 'YES'
                WHEN "outcome" = 'RESPONDED_NO' THEN 'NO'
                ELSE NULL
            END AS "response",
            CASE
                WHEN "outcome" IN ('RESPONDED_YES_CONFIRMED', 'RESPONDED_NO') THEN "respondedAt"
                ELSE NULL
            END AS "completedAt",
            "createdAt",
            "updatedAt"
        FROM "MedicalAppointmentsReminderCycle"
    ) AS src
) AS ranked
WHERE "rn" = 1;

DROP TABLE "SchoolAttendanceReminderCycle";
DROP TABLE "MedicalAppointmentsReminderCycle";

CREATE UNIQUE INDEX "ReminderCycle_userId_reminderType_periodKey_key" ON "ReminderCycle"("userId", "reminderType", "periodKey");
CREATE INDEX "ReminderCycle_reminderType_status_idx" ON "ReminderCycle"("reminderType", "status");

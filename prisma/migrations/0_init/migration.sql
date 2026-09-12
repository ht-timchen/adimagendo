-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "passwordHash" TEXT,
    "name" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'PARTICIPANT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "superAdmin" BOOLEAN NOT NULL DEFAULT false,
    "inviteToken" TEXT,
    "inviteTokenExpiry" DATETIME,
    "lastLoginAt" DATETIME,
    "dateOfBirth" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetName" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParticipantProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "enrollmentDate" DATETIME NOT NULL,
    "studyPhase" TEXT,
    "studyRecordId" TEXT,
    "dataSource" TEXT NOT NULL DEFAULT 'LOCAL',
    "dataKind" TEXT NOT NULL DEFAULT 'TEST',
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "redcapType" TEXT,
    "consentStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ParticipantProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
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
    "prerequisiteKeys" JSONB,
    "bookingPrerequisiteKey" TEXT,
    "unlockOffsetDays" INTEGER,
    "completionGroupKey" TEXT,
    "requiredMilestoneKeys" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistTemplate_surveyTemplateKey_fkey" FOREIGN KEY ("surveyTemplateKey") REFERENCES "SurveyTemplate" ("key") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyMilestone" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "requiredKeys" JSONB NOT NULL,
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

-- CreateTable
CREATE TABLE "ParticipantChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" DATETIME,
    "notes" TEXT,
    "bookingProgress" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "bookedExternallyAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ParticipantChecklistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParticipantChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SymptomEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "painLevel" INTEGER,
    "symptoms" JSONB NOT NULL,
    "notes" TEXT,
    "syncedToRedcap" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SymptomEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AbsenceEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "halfDay" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "context" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AbsenceEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SurveyTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "intervalMonths" INTEGER NOT NULL,
    "questions" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SurveyResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SurveyResponse_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SurveyTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME,
    "location" TEXT,
    "externalUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "addedToCalendar" BOOLEAN NOT NULL DEFAULT false,
    "scheduledStartAt" DATETIME,
    "scheduledLocation" TEXT,
    "participantChecklistItemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Appointment_participantChecklistItemId_fkey" FOREIGN KEY ("participantChecklistItemId") REFERENCES "ParticipantChecklistItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "isReferral" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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

-- CreateTable
CREATE TABLE "MedicalAppointmentsReminderCycle" (
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
    CONSTRAINT "MedicalAppointmentsReminderCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "type" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "projectName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "projectId" TEXT NOT NULL DEFAULT '',
    "startDate" TEXT NOT NULL DEFAULT '',
    "endDate" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "timeZone" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EnrolmentToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "studyRecordId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "redcap_participant_sync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyRecordId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "dateOfBirth" DATETIME,
    "participantConsentDate" DATETIME,
    "parentConsentDate" DATETIME,
    "enrollmentDate" DATETIME,
    "dataKind" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "redcapType" TEXT,
    "consentStatus" TEXT,
    "lastSyncedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_actorUserId_idx" ON "AdminAuditEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_action_idx" ON "AdminAuditEvent"("action");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_targetType_targetId_idx" ON "AdminAuditEvent"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_createdAt_idx" ON "AdminAuditEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantProfile_userId_key" ON "ParticipantProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantProfile_studyRecordId_key" ON "ParticipantProfile"("studyRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_key_key" ON "ChecklistTemplate"("key");

-- CreateIndex
CREATE INDEX "ParticipantMilestone_userId_idx" ON "ParticipantMilestone"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantMilestone_userId_milestoneKey_key" ON "ParticipantMilestone"("userId", "milestoneKey");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantChecklistItem_userId_templateId_key" ON "ParticipantChecklistItem"("userId", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "SymptomEntry_userId_date_key" ON "SymptomEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyTemplate_key_key" ON "SurveyTemplate"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_userId_templateId_key" ON "SurveyResponse"("userId", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_participantChecklistItemId_key" ON "Appointment"("participantChecklistItemId");

-- CreateIndex
CREATE INDEX "SchoolAttendanceReminderCycle_userId_outcome_idx" ON "SchoolAttendanceReminderCycle"("userId", "outcome");

-- CreateIndex
CREATE INDEX "SchoolAttendanceReminderCycle_userId_cycleStartAt_idx" ON "SchoolAttendanceReminderCycle"("userId", "cycleStartAt");

-- CreateIndex
CREATE INDEX "MedicalAppointmentsReminderCycle_userId_outcome_idx" ON "MedicalAppointmentsReminderCycle"("userId", "outcome");

-- CreateIndex
CREATE INDEX "MedicalAppointmentsReminderCycle_userId_cycleStartAt_idx" ON "MedicalAppointmentsReminderCycle"("userId", "cycleStartAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsPost_slug_key" ON "NewsPost"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "EnrolmentToken_token_key" ON "EnrolmentToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "redcap_participant_sync_studyRecordId_key" ON "redcap_participant_sync"("studyRecordId");


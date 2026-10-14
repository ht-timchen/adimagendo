-- Admin replies to a participant's contact message. The reply text is stored on the Notification it creates.
CREATE TABLE "ContactMessageReply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactMessageId" TEXT NOT NULL,
    "adminUserId" TEXT,
    "adminName" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactMessageReply_contactMessageId_fkey" FOREIGN KEY ("contactMessageId") REFERENCES "ContactMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContactMessageReply_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContactMessageReply_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ContactMessageReply_notificationId_key" ON "ContactMessageReply"("notificationId");

CREATE UNIQUE INDEX "ContactMessageReply_submissionId_key" ON "ContactMessageReply"("submissionId");

CREATE INDEX "ContactMessageReply_contactMessageId_createdAt_idx" ON "ContactMessageReply"("contactMessageId", "createdAt");

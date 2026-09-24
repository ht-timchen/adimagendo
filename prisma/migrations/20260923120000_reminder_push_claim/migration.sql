-- Lease columns for concurrent stage sends. pushXSentAt stays unset until a send succeeds.
ALTER TABLE "ReminderCycle" ADD COLUMN "push1ClaimedAt" DATETIME;
ALTER TABLE "ReminderCycle" ADD COLUMN "push2ClaimedAt" DATETIME;
ALTER TABLE "ReminderCycle" ADD COLUMN "push3ClaimedAt" DATETIME;

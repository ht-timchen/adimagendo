-- Baseline QoL survey is due 7 days after enrolment (BASELINE_DUE_DAYS in
-- src/lib/checklist/protocol-timing.ts). The app derives Level 1 due days in code;
-- this keeps the stored value consistent with prisma/seed.ts. Data only; no schema change.

UPDATE "ChecklistTemplate"
SET "dueOffsetDays" = 7
WHERE "key" = 'qol_baseline';

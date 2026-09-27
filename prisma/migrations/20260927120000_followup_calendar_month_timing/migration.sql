-- Follow-up checklist timing: items open on consent date + N calendar months (derived in
-- code from src/lib/checklist/protocol-timing.ts). Data only; no schema change.
-- qol_3m no longer waits for Level 1 blood/MRI confirmations.

UPDATE "ChecklistTemplate"
SET "prerequisiteKeys" = '[]'
WHERE "key" = 'qol_3m';

UPDATE "ChecklistTemplate"
SET "unlockOffsetDays" = 0
WHERE "key" IN (
  'qol_3m',
  'qol_6m',
  'qol_9m',
  'qol_12m',
  'qol_24m',
  'book_ultrasound_3y',
  'book_mri_3y',
  'qol_36m',
  'ultrasound_3y_completed',
  'mri_3y_completed'
);

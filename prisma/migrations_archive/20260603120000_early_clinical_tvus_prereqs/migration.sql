-- Level 1 TVUS: Pre-TVUS after ultrasound booking; Post-TVUS after US complete;
-- Blood/MRI confirmations independent of Post-TVUS.

UPDATE "ChecklistTemplate"
SET "prerequisiteKeys" = '["book_ultrasound"]'
WHERE "key" = 'pre_tvus_survey';

UPDATE "ChecklistTemplate"
SET "prerequisiteKeys" = '["ultrasound_completed"]'
WHERE "key" = 'post_tvus_survey';

UPDATE "ChecklistTemplate"
SET "prerequisiteKeys" = '["book_bloods"]'
WHERE "key" = 'confirm_blood_test';

UPDATE "ChecklistTemplate"
SET "prerequisiteKeys" = '["book_mri"]'
WHERE "key" = 'confirm_mri';

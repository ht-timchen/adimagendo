-- Follow-up QoL surveys: dueOffsetDays is the completion window; unlock is prerequisite-based only.
UPDATE "ChecklistTemplate"
SET "unlockOffsetDays" = 0
WHERE "key" IN ('qol_3m', 'qol_6m', 'qol_9m', 'qol_12m', 'qol_24m', 'qol_36m');

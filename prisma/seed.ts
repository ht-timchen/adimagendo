import { ChecklistItemType, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { assertProtocolValid, validateProtocol } from "./validate-protocol";
import { deleteOrphanedParticipantChecklistItems } from "../src/lib/valid-checklist-items";
import { BOOK_APPOINTMENT_ROWS } from "../src/lib/checklist-booking-group";

function bookExternalUrl(templateKey: string): string | undefined {
  return BOOK_APPOINTMENT_ROWS.find((r) => r.templateKey === templateKey)
    ?.externalUrl;
}

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@adimagendo.local";
const ADMIN_PASSWORD = "imagendoadmin";
const ADMIN_NAME = "Admin";

/** Placeholder REDCap URLs — replace per instrument when available. */
const REDCAP_PLACEHOLDER =
  process.env.REDCAP_PLACEHOLDER_URL ??
  "https://surveys.adelaide.edu.au/redcap/surveys/?s=XPJJPXPADKK7RYMA";

const SCALE_QUESTIONS = [
  {
    id: "q1",
    text: "Overall, how would you rate your quality of life?",
    type: "scale",
    min: 1,
    max: 10,
  },
  {
    id: "q2",
    text: "How would you rate your health today?",
    type: "scale",
    min: 1,
    max: 5,
  },
] as const;

type SurveySeed = {
  key: string;
  title: string;
  description: string;
  intervalMonths: number;
};

type ChecklistSeed = {
  key: string;
  title: string;
  description: string;
  type: ChecklistItemType;
  sortOrder: number;
  externalUrl?: string;
  dueOffsetDays?: number;
  unlockOffsetDays?: number;
  surveyTemplateKey?: string;
  redcapUrl?: string;
  prerequisiteKeys?: string[];
  requiredMilestoneKeys?: string[];
  completionGroupKey?: string;
  bookingPrerequisiteKey?: string;
};

/** Level 1 monitoring display only — not an unlock trigger. */
const LEVEL_1_DUE_OFFSET_DAYS = 56;

const DEPRECATED_CHECKLIST_KEYS = ["enrollment_survey", "book_appointment"];
const DEPRECATED_SURVEY_KEYS = ["enrollment_survey"];

const SURVEY_TEMPLATES: SurveySeed[] = [
  {
    key: "qol_baseline",
    title: "Baseline QoL survey",
    description: "Baseline quality-of-life questionnaire",
    intervalMonths: 0,
  },
  {
    key: "pre_tvus_survey",
    title: "Pre-TVUS survey",
    description: "Before transvaginal ultrasound",
    intervalMonths: 0,
  },
  {
    key: "post_tvus_survey",
    title: "Post-TVUS survey",
    description: "After transvaginal ultrasound",
    intervalMonths: 0,
  },
  { key: "qol_3m", title: "3-month survey", description: "3-month follow-up", intervalMonths: 3 },
  { key: "qol_6m", title: "6-month survey", description: "6-month follow-up", intervalMonths: 6 },
  { key: "qol_9m", title: "9-month survey", description: "9-month follow-up", intervalMonths: 9 },
  {
    key: "qol_12m",
    title: "12-month survey",
    description: "12-month follow-up",
    intervalMonths: 12,
  },
  {
    key: "qol_24m",
    title: "24-month survey",
    description: "24-month follow-up",
    intervalMonths: 24,
  },
  {
    key: "qol_36m",
    title: "36-month survey",
    description: "36-month follow-up",
    intervalMonths: 36,
  },
];

const BOOK_APPOINTMENT_PREREQS = ["book_ultrasound", "book_mri", "book_bloods"];

const CHECKLIST_TEMPLATES: ChecklistSeed[] = [
  {
    key: "qol_baseline",
    title: "Baseline QoL survey",
    description: "Complete your baseline quality-of-life questionnaire.",
    type: "SURVEY",
    sortOrder: 0,
    surveyTemplateKey: "qol_baseline",
    redcapUrl: REDCAP_PLACEHOLDER,
    prerequisiteKeys: [],
    dueOffsetDays: LEVEL_1_DUE_OFFSET_DAYS,
    unlockOffsetDays: 0,
  },
  {
    key: "book_ultrasound",
    title: "Book ultrasound",
    description: "Book your transvaginal ultrasound appointment.",
    type: "APPOINTMENT",
    sortOrder: 1,
    externalUrl: bookExternalUrl("book_ultrasound"),
    prerequisiteKeys: [],
    completionGroupKey: "book_appointments",
    dueOffsetDays: LEVEL_1_DUE_OFFSET_DAYS,
    unlockOffsetDays: 0,
  },
  {
    key: "book_mri",
    title: "Book MRI",
    description: "Book your MRI appointment.",
    type: "APPOINTMENT",
    sortOrder: 2,
    externalUrl: bookExternalUrl("book_mri"),
    prerequisiteKeys: [],
    completionGroupKey: "book_appointments",
    dueOffsetDays: LEVEL_1_DUE_OFFSET_DAYS,
    unlockOffsetDays: 0,
  },
  {
    key: "book_bloods",
    title: "Book blood test",
    description: "Book your blood test appointment.",
    type: "APPOINTMENT",
    sortOrder: 3,
    externalUrl: bookExternalUrl("book_bloods"),
    prerequisiteKeys: [],
    completionGroupKey: "book_appointments",
    dueOffsetDays: LEVEL_1_DUE_OFFSET_DAYS,
    unlockOffsetDays: 0,
  },
  {
    key: "pre_tvus_survey",
    title: "Pre-TVUS survey",
    description: "Complete before your ultrasound appointment.",
    type: "SURVEY",
    sortOrder: 4,
    surveyTemplateKey: "pre_tvus_survey",
    redcapUrl: REDCAP_PLACEHOLDER,
    prerequisiteKeys: [],
    bookingPrerequisiteKey: "book_ultrasound",
    dueOffsetDays: LEVEL_1_DUE_OFFSET_DAYS,
    unlockOffsetDays: 0,
  },
  {
    key: "ultrasound_completed",
    title: "Ultrasound completed",
    description: "Confirm your transvaginal ultrasound is complete.",
    type: "SCAN",
    sortOrder: 5,
    prerequisiteKeys: ["pre_tvus_survey"],
    dueOffsetDays: LEVEL_1_DUE_OFFSET_DAYS,
    unlockOffsetDays: 0,
  },
  {
    key: "post_tvus_survey",
    title: "Post-TVUS survey",
    description: "Complete after your ultrasound appointment.",
    type: "SURVEY",
    sortOrder: 6,
    surveyTemplateKey: "post_tvus_survey",
    redcapUrl: REDCAP_PLACEHOLDER,
    prerequisiteKeys: ["ultrasound_completed"],
    dueOffsetDays: LEVEL_1_DUE_OFFSET_DAYS,
    unlockOffsetDays: 0,
  },
  {
    key: "confirm_blood_test",
    title: "Blood test completed",
    description: "Confirm your blood test is complete.",
    type: "BLOOD_TEST",
    sortOrder: 7,
    prerequisiteKeys: ["book_bloods"],
    completionGroupKey: "level_1_imaging",
    dueOffsetDays: LEVEL_1_DUE_OFFSET_DAYS,
    unlockOffsetDays: 0,
  },
  {
    key: "confirm_mri",
    title: "MRI completed",
    description: "Confirm your MRI is complete.",
    type: "OTHER",
    sortOrder: 8,
    prerequisiteKeys: ["book_mri"],
    completionGroupKey: "level_1_imaging",
    dueOffsetDays: LEVEL_1_DUE_OFFSET_DAYS,
    unlockOffsetDays: 0,
  },
  {
    key: "qol_3m",
    title: "3-month survey",
    description: "Complete your 3-month follow-up survey.",
    type: "SURVEY",
    sortOrder: 9,
    surveyTemplateKey: "qol_3m",
    redcapUrl: REDCAP_PLACEHOLDER,
    prerequisiteKeys: ["confirm_blood_test", "confirm_mri"],
    requiredMilestoneKeys: ["level_1_complete"],
    dueOffsetDays: 90,
    unlockOffsetDays: 0,
  },
  {
    key: "qol_6m",
    title: "6-month survey",
    description: "Complete your 6-month follow-up survey.",
    type: "SURVEY",
    sortOrder: 10,
    surveyTemplateKey: "qol_6m",
    redcapUrl: REDCAP_PLACEHOLDER,
    prerequisiteKeys: ["qol_3m"],
    dueOffsetDays: 180,
    unlockOffsetDays: 0,
  },
  {
    key: "qol_9m",
    title: "9-month survey",
    description: "Complete your 9-month follow-up survey.",
    type: "SURVEY",
    sortOrder: 11,
    surveyTemplateKey: "qol_9m",
    redcapUrl: REDCAP_PLACEHOLDER,
    prerequisiteKeys: ["qol_6m"],
    dueOffsetDays: 270,
    unlockOffsetDays: 0,
  },
  {
    key: "qol_12m",
    title: "12-month survey",
    description: "Complete your 12-month follow-up survey.",
    type: "SURVEY",
    sortOrder: 12,
    surveyTemplateKey: "qol_12m",
    redcapUrl: REDCAP_PLACEHOLDER,
    prerequisiteKeys: ["qol_9m"],
    dueOffsetDays: 360,
    unlockOffsetDays: 0,
  },
  {
    key: "qol_24m",
    title: "24-month survey",
    description: "Complete your 24-month follow-up survey.",
    type: "SURVEY",
    sortOrder: 13,
    surveyTemplateKey: "qol_24m",
    redcapUrl: REDCAP_PLACEHOLDER,
    prerequisiteKeys: ["qol_12m"],
    requiredMilestoneKeys: ["level_2_complete"],
    dueOffsetDays: 730,
    unlockOffsetDays: 0,
  },
  {
    key: "mri_3y_completed",
    title: "3-year MRI completed",
    description: "Confirm your 3-year MRI is complete.",
    type: "SCAN",
    sortOrder: 14,
    prerequisiteKeys: ["qol_24m"],
    requiredMilestoneKeys: ["level_2_complete"],
    dueOffsetDays: 1095,
    unlockOffsetDays: 1095,
  },
  {
    key: "qol_36m",
    title: "36-month survey",
    description: "Complete your 36-month follow-up survey.",
    type: "SURVEY",
    sortOrder: 15,
    surveyTemplateKey: "qol_36m",
    redcapUrl: REDCAP_PLACEHOLDER,
    prerequisiteKeys: ["mri_3y_completed"],
    dueOffsetDays: 1095,
    unlockOffsetDays: 0,
  },
];

const STUDY_MILESTONES = [
  {
    key: "level_1_complete",
    title: "Level 1 complete",
    requiredKeys: [
      "qol_baseline",
      ...BOOK_APPOINTMENT_PREREQS,
      "pre_tvus_survey",
      "ultrasound_completed",
      "post_tvus_survey",
      "confirm_blood_test",
      "confirm_mri",
    ],
    sortOrder: 0,
  },
  {
    key: "level_2_complete",
    title: "Level 2 complete",
    requiredKeys: ["qol_3m", "qol_6m", "qol_9m", "qol_12m"],
    sortOrder: 1,
  },
  {
    key: "long_term_complete",
    title: "Long-term follow-up complete",
    requiredKeys: ["qol_24m", "mri_3y_completed", "qol_36m"],
    sortOrder: 2,
  },
];

async function main() {
  const validation = validateProtocol(CHECKLIST_TEMPLATES, STUDY_MILESTONES);
  assertProtocolValid(validation);

  for (const survey of SURVEY_TEMPLATES) {
    await prisma.surveyTemplate.upsert({
      where: { key: survey.key },
      create: {
        key: survey.key,
        title: survey.title,
        description: survey.description,
        intervalMonths: survey.intervalMonths,
        questions: SCALE_QUESTIONS,
      },
      update: {
        title: survey.title,
        description: survey.description,
        intervalMonths: survey.intervalMonths,
      },
    });
  }

  for (const step of CHECKLIST_TEMPLATES) {
    await prisma.checklistTemplate.upsert({
      where: { key: step.key },
      create: {
        key: step.key,
        title: step.title,
        description: step.description,
        type: step.type,
        sortOrder: step.sortOrder,
        externalUrl: step.externalUrl,
        dueOffsetDays: step.dueOffsetDays,
        unlockOffsetDays: step.unlockOffsetDays,
        surveyTemplateKey: step.surveyTemplateKey,
        redcapUrl: step.redcapUrl,
        prerequisiteKeys: step.prerequisiteKeys ?? [],
        bookingPrerequisiteKey: step.bookingPrerequisiteKey ?? null,
        requiredMilestoneKeys: step.requiredMilestoneKeys ?? [],
        completionGroupKey: step.completionGroupKey,
      },
      update: {
        title: step.title,
        description: step.description,
        type: step.type,
        sortOrder: step.sortOrder,
        externalUrl: step.externalUrl,
        dueOffsetDays: step.dueOffsetDays,
        unlockOffsetDays: step.unlockOffsetDays,
        surveyTemplateKey: step.surveyTemplateKey,
        redcapUrl: step.redcapUrl,
        prerequisiteKeys: step.prerequisiteKeys ?? [],
        bookingPrerequisiteKey: step.bookingPrerequisiteKey ?? null,
        requiredMilestoneKeys: step.requiredMilestoneKeys ?? [],
        completionGroupKey: step.completionGroupKey,
      },
    });
  }

  for (const milestone of STUDY_MILESTONES) {
    await prisma.studyMilestone.upsert({
      where: { key: milestone.key },
      create: {
        key: milestone.key,
        title: milestone.title,
        requiredKeys: milestone.requiredKeys,
        sortOrder: milestone.sortOrder,
      },
      update: {
        title: milestone.title,
        requiredKeys: milestone.requiredKeys,
        sortOrder: milestone.sortOrder,
      },
    });
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      role: "ADMIN",
      superAdmin: true,
    },
    update: { name: ADMIN_NAME, passwordHash, role: "ADMIN", superAdmin: true },
  });
  await prisma.participantProfile.upsert({
    where: { userId: admin.id },
    create: {
      userId: admin.id,
      enrollmentDate: new Date(),
      studyPhase: "admin",
      dataSource: "LOCAL",
      dataKind: "TEST",
    },
    update: {
      dataSource: "LOCAL",
      dataKind: "TEST",
    },
  });

  await prisma.checklistTemplate.deleteMany({
    where: { key: { in: DEPRECATED_CHECKLIST_KEYS } },
  });
  await prisma.surveyTemplate.deleteMany({
    where: { key: { in: DEPRECATED_SURVEY_KEYS } },
  });

  const orphansRemoved = await deleteOrphanedParticipantChecklistItems();
  if (orphansRemoved > 0) {
    console.log(`Removed ${orphansRemoved} orphaned participant checklist row(s).`);
  }

  console.log("Seed completed: protocol checklist, surveys, and milestones.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

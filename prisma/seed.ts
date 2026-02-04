import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.checklistTemplate.upsert({
    where: { key: "endometriosis_scan" },
    create: {
      key: "endometriosis_scan",
      title: "Endometriosis-specific scan",
      description: "Book your free endometriosis-specific scan.",
      type: "SCAN",
      externalUrl: "https://example.com/book-scan",
      dueOffsetDays: 0,
      sortOrder: 0,
    },
    update: {},
  });

  await prisma.checklistTemplate.upsert({
    where: { key: "antral_follicle" },
    create: {
      key: "antral_follicle",
      title: "Antral follicle count",
      description: "Have your antral follicle count done.",
      type: "OTHER",
      dueOffsetDays: 0,
      sortOrder: 1,
    },
    update: {},
  });

  await prisma.checklistTemplate.upsert({
    where: { key: "fasting_glucose" },
    create: {
      key: "fasting_glucose",
      title: "Fasting glucose blood test",
      description: "Complete your fasting glucose blood test.",
      type: "BLOOD_TEST",
      dueOffsetDays: 0,
      sortOrder: 2,
    },
    update: {},
  });

  await prisma.checklistTemplate.upsert({
    where: { key: "qol_baseline" },
    create: {
      key: "qol_baseline",
      title: "Baseline QoL survey",
      description: "Complete your baseline quality of life survey.",
      type: "SURVEY",
      dueOffsetDays: 0,
      sortOrder: 3,
    },
    update: {},
  });

  for (const months of [3, 6, 9, 12]) {
    await prisma.checklistTemplate.upsert({
      where: { key: `qol_${months}m` },
      create: {
        key: `qol_${months}m`,
        title: `${months}-month QoL survey`,
        description: `Complete your ${months}-month quality of life survey.`,
        type: "SURVEY",
        dueOffsetDays: months * 30,
        sortOrder: 4 + months,
      },
      update: {},
    });
  }

  await prisma.surveyTemplate.upsert({
    where: { key: "qol_baseline" },
    create: {
      key: "qol_baseline",
      title: "Baseline quality of life",
      description: "Baseline assessment",
      intervalMonths: 0,
      questions: [
        { id: "q1", text: "Overall, how would you rate your quality of life?", type: "scale", min: 1, max: 10 },
        { id: "q2", text: "How would you rate your health today?", type: "scale", min: 1, max: 5 },
      ],
    },
    update: {},
  });

  for (const months of [3, 6, 9, 12]) {
    await prisma.surveyTemplate.upsert({
      where: { key: `qol_${months}m` },
      create: {
        key: `qol_${months}m`,
        title: `${months}-month quality of life`,
        description: `${months}-month follow-up`,
        intervalMonths: months,
        questions: [
          { id: "q1", text: "Overall, how would you rate your quality of life?", type: "scale", min: 1, max: 10 },
          { id: "q2", text: "How would you rate your health today?", type: "scale", min: 1, max: 5 },
        ],
      },
      update: {},
    });
  }

  console.log("Seed completed.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

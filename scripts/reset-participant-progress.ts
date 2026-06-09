/**
 * Reset one participant to brand-new study state (keeps User + auth).
 * Usage: npx tsx scripts/reset-participant-progress.ts <email>
 */
import { PrismaClient } from "@prisma/client";
import { LOCAL_TEST_PROFILE } from "../src/lib/participant/participant-data-classification";
import { isLockedPilotClassification } from "../src/lib/participant/preserve-pilot-classification";

const prisma = new PrismaClient();

const EMAIL = process.argv[2] ?? "jie.huang@student.adelaide.edu.au";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    console.error(`User not found: ${EMAIL}`);
    process.exit(1);
  }

  const [
    checklist,
    surveys,
    appointments,
    milestones,
    symptoms,
    absences,
    documents,
    notifications,
    contactMessages,
  ] = await Promise.all([
    prisma.participantChecklistItem.deleteMany({ where: { userId: user.id } }),
    prisma.surveyResponse.deleteMany({ where: { userId: user.id } }),
    prisma.appointment.deleteMany({ where: { userId: user.id } }),
    prisma.participantMilestone.deleteMany({ where: { userId: user.id } }),
    prisma.symptomEntry.deleteMany({ where: { userId: user.id } }),
    prisma.absenceEntry.deleteMany({ where: { userId: user.id } }),
    prisma.document.deleteMany({ where: { userId: user.id } }),
    prisma.notification.deleteMany({ where: { userId: user.id } }),
    prisma.contactMessage.deleteMany({ where: { userId: user.id } }),
  ]);

  const existingProfile = await prisma.participantProfile.findUnique({
    where: { userId: user.id },
    select: { studyRecordId: true, dataSource: true, dataKind: true },
  });

  if (existingProfile && isLockedPilotClassification(existingProfile)) {
    console.warn(
      "WARNING: Participant is classified as REAL pilot — classification will be preserved during this dev reset."
    );
  }

  const profileData = existingProfile?.studyRecordId
    ? {
        enrollmentDate: new Date(),
        studyPhase: "baseline" as const,
        dataSource: existingProfile.dataSource,
        dataKind: existingProfile.dataKind,
      }
    : {
        enrollmentDate: new Date(),
        studyPhase: "baseline" as const,
        studyRecordId: null,
        ...LOCAL_TEST_PROFILE,
      };

  await prisma.participantProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      ...profileData,
    },
    update: profileData,
  });

  console.log(`Reset participant progress for ${user.email} (${user.id})`);
  console.log({
    checklistItems: checklist.count,
    surveyResponses: surveys.count,
    appointments: appointments.count,
    milestones: milestones.count,
    symptomEntries: symptoms.count,
    absenceEntries: absences.count,
    documents: documents.count,
    notifications: notifications.count,
    contactMessages: contactMessages.count,
  });
  console.log("Profile set to baseline with enrollmentDate = today.");
  console.log("User account, password, and sessions were not modified.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

import { prisma } from "@/lib/db";

export async function getOrCreateProjectSettings() {
  let row = await prisma.projectSettings.findUnique({ where: { id: "default" } });
  if (!row) {
    row = await prisma.projectSettings.create({
      data: {
        id: "default",
        projectName: process.env.NEXT_PUBLIC_PROJECT_NAME ?? "ADIMAGENDO",
        description:
          process.env.NEXT_PUBLIC_PROJECT_DESCRIPTION ??
          "Clinical study participant management and engagement.",
        projectId: process.env.NEXT_PUBLIC_PROJECT_ID ?? "ADIMAGENDO-001",
        startDate: process.env.NEXT_PUBLIC_PROJECT_START ?? "",
        endDate: process.env.NEXT_PUBLIC_PROJECT_END ?? "",
        status: process.env.NEXT_PUBLIC_PROJECT_STATUS ?? "Active recruitment",
        timeZone:
          process.env.NEXT_PUBLIC_PROJECT_TIMEZONE ??
          Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
  }
  return row;
}

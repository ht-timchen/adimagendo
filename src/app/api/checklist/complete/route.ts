import { NextResponse } from "next/server";
import { requireParticipantApiSession } from "@/lib/participant-api-auth";
import { prisma } from "@/lib/db";
import { ensureLevelCompleteNotification } from "@/lib/checklist/ensure-level-complete-notification";
import { isLevel1Complete } from "@/lib/checklist/level1-follow-up";
import {
  isLevel2Complete,
  isLevel3Complete,
} from "@/lib/checklist/level2-follow-up";
import { getStepCompletionBlock } from "@/lib/workflow/assert-step-available";
import { alreadyCompletedResponse } from "@/lib/workflow/completion-response";
import { z } from "zod";

const BodySchema = z.object({
  templateId: z.string(),
});

function resolveLevelJustCompleted(
  completedKeysBefore: Set<string>,
  completedKeysAfter: Set<string>
): 1 | 2 | 3 | null {
  if (!isLevel1Complete(completedKeysBefore) && isLevel1Complete(completedKeysAfter)) {
    return 1;
  }
  if (!isLevel2Complete(completedKeysBefore) && isLevel2Complete(completedKeysAfter)) {
    return 2;
  }
  if (!isLevel3Complete(completedKeysBefore) && isLevel3Complete(completedKeysAfter)) {
    return 3;
  }
  return null;
}

export async function POST(req: Request) {
  const authResult = await requireParticipantApiSession();
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult.ctx;
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const template = await prisma.checklistTemplate.findUnique({
      where: { id: parsed.data.templateId },
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const workflowBlock = await getStepCompletionBlock(
      userId,
      template.key
    );
    if (workflowBlock) {
      return NextResponse.json(workflowBlock, { status: 403 });
    }

    const existing = await prisma.participantChecklistItem.findUnique({
      where: {
        userId_templateId: {
          userId: userId,
          templateId: parsed.data.templateId,
        },
      },
    });

    if (existing?.status === "COMPLETED") {
      return alreadyCompletedResponse();
    }

    if (template.externalUrl?.trim()) {
      if (existing?.bookingProgress !== "CONFIRMED") {
        return NextResponse.json(
          {
            error:
              "Confirm your appointment date and time using \"Confirm appointment details\" before marking this item complete.",
          },
          { status: 400 }
        );
      }
    }

    const checklistItemsBefore = await prisma.participantChecklistItem.findMany({
      where: { userId: userId },
      select: {
        status: true,
        template: { select: { key: true } },
      },
    });
    const completedKeysBefore = new Set(
      checklistItemsBefore
        .filter((item) => item.status === "COMPLETED")
        .map((item) => item.template.key)
    );

    await prisma.participantChecklistItem.upsert({
      where: {
        userId_templateId: {
          userId: userId,
          templateId: parsed.data.templateId,
        },
      },
      create: {
        userId: userId,
        templateId: parsed.data.templateId,
        status: "COMPLETED",
        completedAt: new Date(),
      },
      update: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    const completedKeysAfter = new Set(completedKeysBefore);
    completedKeysAfter.add(template.key);

    const levelJustCompleted = resolveLevelJustCompleted(
      completedKeysBefore,
      completedKeysAfter
    );

    if (isLevel1Complete(completedKeysAfter)) {
      await ensureLevelCompleteNotification(userId, "level_1_complete");
    }
    if (isLevel2Complete(completedKeysAfter)) {
      await ensureLevelCompleteNotification(userId, "level_2_complete");
    }
    if (isLevel3Complete(completedKeysAfter)) {
      await ensureLevelCompleteNotification(userId, "level_3_complete");
    }

    return NextResponse.json({ ok: true, levelJustCompleted });
  } catch (e) {
    console.error("Checklist complete error:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

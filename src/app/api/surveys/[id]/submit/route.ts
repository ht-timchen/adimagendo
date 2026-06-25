import { NextResponse } from "next/server";
import { requireParticipantApiSession } from "@/lib/participant-api-auth";
import { prisma } from "@/lib/db";
import { getStepCompletionBlock } from "@/lib/workflow/assert-step-available";
import {
  alreadyCompletedResponse,
  completionOkResponse,
} from "@/lib/workflow/completion-response";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

const BodySchema = z.object({
  answers: z.record(z.string(), z.unknown()),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireParticipantApiSession();
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult.ctx;
  const { id: templateId } = await params;
  const template = await prisma.surveyTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const checklistTemplate = await prisma.checklistTemplate.findFirst({
    where: {
      key: template.key,
      type: "SURVEY",
    },
  });
  if (checklistTemplate) {
    const workflowBlock = await getStepCompletionBlock(
      userId,
      checklistTemplate.key
    );
    if (workflowBlock) {
      return NextResponse.json(workflowBlock, { status: 403 });
    }
  }

  const existingResponse = await prisma.surveyResponse.findUnique({
    where: {
      userId_templateId: { userId: userId, templateId },
    },
    select: { completed: true },
  });
  if (existingResponse?.completed) {
    return alreadyCompletedResponse();
  }

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const answers = parsed.data.answers as Prisma.InputJsonValue;
    await prisma.surveyResponse.upsert({
      where: {
        userId_templateId: { userId: userId, templateId },
      },
      create: {
        userId: userId,
        templateId,
        answers,
        completed: true,
        completedAt: new Date(),
      },
      update: {
        answers,
        completed: true,
        completedAt: new Date(),
      },
    });

    /**
     * TODO: Migrate checklist status update to REDCap Webhook.
     */
    if (checklistTemplate) {
      const existingChecklistItem =
        await prisma.participantChecklistItem.findUnique({
          where: {
            userId_templateId: {
              userId: userId,
              templateId: checklistTemplate.id,
            },
          },
          select: { status: true },
        });

      if (existingChecklistItem?.status !== "COMPLETED") {
        await prisma.participantChecklistItem.upsert({
          where: {
            userId_templateId: {
              userId: userId,
              templateId: checklistTemplate.id,
            },
          },
          create: {
            userId: userId,
            templateId: checklistTemplate.id,
            status: "COMPLETED",
            completedAt: new Date(),
          },
          update: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
      }
    }

    return completionOkResponse();
  } catch (e) {
    console.error("Survey submit error:", e);
    return NextResponse.json(
      { error: "Failed to submit" },
      { status: 500 }
    );
  }
}

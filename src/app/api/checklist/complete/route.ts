import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getStepCompletionBlock } from "@/lib/workflow/assert-step-available";
import {
  alreadyCompletedResponse,
  completionOkResponse,
} from "@/lib/workflow/completion-response";
import { z } from "zod";

const BodySchema = z.object({
  templateId: z.string(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
      session.user.id,
      template.key
    );
    if (workflowBlock) {
      return NextResponse.json(workflowBlock, { status: 403 });
    }

    const existing = await prisma.participantChecklistItem.findUnique({
      where: {
        userId_templateId: {
          userId: session.user.id,
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

    await prisma.participantChecklistItem.upsert({
      where: {
        userId_templateId: {
          userId: session.user.id,
          templateId: parsed.data.templateId,
        },
      },
      create: {
        userId: session.user.id,
        templateId: parsed.data.templateId,
        status: "COMPLETED",
        completedAt: new Date(),
      },
      update: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    return completionOkResponse();
  } catch (e) {
    console.error("Checklist complete error:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

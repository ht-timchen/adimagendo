import { NextResponse } from "next/server";
import { requireParticipantApiSession } from "@/lib/participant-api-auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireParticipantApiSession();
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult.ctx;
  const { id } = await params;
  const template = await prisma.surveyTemplate.findUnique({
    where: { id },
  });
  if (!template) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }
  const existing = await prisma.surveyResponse.findUnique({
    where: {
      userId_templateId: { userId: userId, templateId: id },
    },
  });
  return NextResponse.json({
    template: {
      id: template.id,
      title: template.title,
      description: template.description,
      questions: template.questions as Array<{
        id: string;
        text: string;
        type: string;
        min?: number;
        max?: number;
      }>,
    },
    existingAnswers: existing?.answers as Record<string, unknown> | null,
    completed: existing?.completed ?? false,
  });
}

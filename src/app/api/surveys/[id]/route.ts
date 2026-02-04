import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const template = await prisma.surveyTemplate.findUnique({
    where: { id },
  });
  if (!template) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }
  const existing = await prisma.surveyResponse.findUnique({
    where: {
      userId_templateId: { userId: session.user.id, templateId: id },
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

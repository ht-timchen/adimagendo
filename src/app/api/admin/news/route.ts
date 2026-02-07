import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const CreateSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  content: z.string(),
  excerpt: z.string().optional(),
  published: z.boolean().optional(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const posts = await prisma.newsPost.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(posts);
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { title, slug, content, excerpt, published } = parsed.data;
    const post = await prisma.newsPost.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt ?? null,
        published: published ?? false,
        publishedAt: published ? new Date() : null,
      },
    });
    return NextResponse.json(post);
  } catch (e) {
    console.error("Admin news create:", e);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}

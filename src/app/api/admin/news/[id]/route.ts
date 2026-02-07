import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const UpdateSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  content: z.string().optional(),
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const post = await prisma.newsPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(post);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.newsPost.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data: {
      title?: string;
      slug?: string;
      content?: string;
      excerpt?: string | null;
      published?: boolean;
      publishedAt?: Date | null;
    } = {};
    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.slug !== undefined) data.slug = parsed.data.slug;
    if (parsed.data.content !== undefined) data.content = parsed.data.content;
    if (parsed.data.excerpt !== undefined) data.excerpt = parsed.data.excerpt;
    if (parsed.data.published !== undefined) {
      data.published = parsed.data.published;
      data.publishedAt = parsed.data.published ? new Date() : null;
    }
    const post = await prisma.newsPost.update({
      where: { id },
      data,
    });
    return NextResponse.json(post);
  } catch (e) {
    console.error("Admin news update:", e);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

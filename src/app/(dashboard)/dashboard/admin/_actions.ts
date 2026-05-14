"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { ensureAdmin, ensurePeopleAdmin } from "@/lib/people-admin-auth";

export { ensureAdmin, ensurePeopleAdmin };

function slugifyBase(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export async function createNewsPostAction(formData: FormData) {
  await ensureAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim() || null;
  const published = formData.get("published") === "on";
  if (!title || !content) redirect("/dashboard/admin/news?error=missing-fields");
  let base = slugifyBase(title) || "post";
  let slug = base;
  let n = 0;
  while (await prisma.newsPost.findUnique({ where: { slug }, select: { id: true } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  await prisma.newsPost.create({
    data: {
      title,
      slug,
      content,
      excerpt,
      published,
      publishedAt: published ? new Date() : null,
    },
  });
  revalidatePath("/dashboard/admin/news");
  redirect("/dashboard/admin/news");
}

export async function deleteNewsPostAction(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.newsPost.delete({ where: { id } }).catch(() => null);
  revalidatePath("/dashboard/admin/news");
  redirect("/dashboard/admin/news");
}

export async function updateNewsPostAction(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim() || null;
  const published = formData.get("published") === "on";
  if (!id || !title || !content) redirect("/dashboard/admin/news?error=missing-fields");
  await prisma.newsPost.update({
    where: { id },
    data: {
      title,
      content,
      excerpt,
      published,
      publishedAt: published ? new Date() : null,
    },
  });
  revalidatePath("/dashboard/admin/news");
  redirect("/dashboard/admin/news");
}

export async function notifyAllParticipantsAction(formData: FormData) {
  await ensureAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title) redirect("/dashboard/admin/actions/notify?error=missing-title");
  const ids = await prisma.user.findMany({
    where: { role: "PARTICIPANT", active: true },
    select: { id: true },
  });
  await prisma.notification.createMany({
    data: ids.map((u) => ({
      userId: u.id,
      title,
      body: body || null,
      type: "admin_broadcast",
    })),
  });
  revalidatePath("/dashboard/admin/actions/notify");
  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin/actions/notify");
}

export async function notifyParticipantAction(formData: FormData) {
  await ensureAdmin();
  const userId = String(formData.get("userId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!userId || !title) redirect("/dashboard/admin/participants?error=missing-fields");
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!u || u.role !== "PARTICIPANT") redirect("/dashboard/admin/participants?error=invalid-user");
  await prisma.notification.create({
    data: { userId, title, body: body || null, type: "admin_push" },
  });
  revalidatePath("/dashboard/admin/participants");
  redirect("/dashboard/admin/participants");
}

export async function resetParticipantPasswordAction(formData: FormData) {
  await ensureAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) redirect("/dashboard/admin/participants?error=missing-user");
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!u || u.role !== "PARTICIPANT") redirect("/dashboard/admin/participants?error=invalid-user");
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let temp = "";
  for (let i = 0; i < 12; i++) temp += chars[Math.floor(Math.random() * chars.length)];
  const passwordHash = await bcrypt.hash(temp, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  const jar = await cookies();
  jar.set("admin_pw_flash", JSON.stringify({ userId, password: temp }), {
    httpOnly: true,
    maxAge: 300,
    path: "/dashboard/admin/participants",
    sameSite: "lax",
  });
  revalidatePath("/dashboard/admin/participants");
  redirect("/dashboard/admin/participants");
}

export async function dismissPasswordFlashAction() {
  await ensureAdmin();
  const jar = await cookies();
  jar.delete("admin_pw_flash");
  redirect("/dashboard/admin/participants");
}

export async function createAdminPersonAction(formData: FormData) {
  await ensurePeopleAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !email || password.length < 8) redirect("/dashboard/admin/people?error=invalid-fields");
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) redirect("/dashboard/admin/people?error=email-in-use");
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: "ADMIN",
      active: true,
      superAdmin: false,
    },
  });
  revalidatePath("/dashboard/admin/people");
  redirect("/dashboard/admin/people");
}

export async function setAdminActiveAction(formData: FormData) {
  const session = await ensurePeopleAdmin();
  const userId = String(formData.get("userId") ?? "");
  const active = formData.get("active") === "true";
  if (!userId || userId === session.user.id) redirect("/dashboard/admin/people?error=cannot-self");
  await prisma.user.update({
    where: { id: userId, role: "ADMIN" },
    data: { active },
  });
  revalidatePath("/dashboard/admin/people");
  redirect("/dashboard/admin/people");
}

export async function updateAdminPersonAction(formData: FormData) {
  await ensurePeopleAdmin();
  const userId = String(formData.get("userId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!userId || !name) redirect("/dashboard/admin/people?error=missing-fields");
  await prisma.user.update({
    where: { id: userId, role: "ADMIN" },
    data: { name },
  });
  revalidatePath("/dashboard/admin/people");
  redirect("/dashboard/admin/people");
}

export async function sendParticipantPushAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await ensureAdmin();
  const userId = String(formData.get("userId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!userId || !title) {
    return { ok: false, error: "Participant and title are required." };
  }
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!u || u.role !== "PARTICIPANT") {
    return { ok: false, error: "Invalid participant." };
  }
  await prisma.notification.create({
    data: { userId, title, body: body || null, type: "admin_push" },
  });
  revalidatePath("/dashboard/admin");
  return { ok: true };
}

export async function updateProjectSettingsAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await ensureAdmin();
  const projectName = String(formData.get("projectName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const timeZone = String(formData.get("timeZone") ?? "").trim();

  if (!projectName) {
    return { ok: false, error: "Project name is required." };
  }
  const allowed = new Set(["Active", "Paused", "Completed"]);
  if (!allowed.has(status)) {
    return { ok: false, error: "Invalid project status." };
  }

  await prisma.projectSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      projectName,
      description,
      projectId,
      startDate,
      endDate,
      status,
      timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    update: {
      projectName,
      description,
      projectId,
      startDate,
      endDate,
      status,
      timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
  revalidatePath("/dashboard/admin/settings");
  revalidatePath("/dashboard/admin");
  return { ok: true };
}

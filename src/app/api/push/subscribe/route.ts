import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const SubscriptionSchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  expirationTime: z.number().nullable().optional(),
});

const VerifyQuerySchema = z.object({
  endpoint: z.string().min(1),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = VerifyQuerySchema.safeParse({
    endpoint: searchParams.get("endpoint"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { endpoint } = parsed.data;
  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint },
    select: { userId: true },
  });

  return NextResponse.json({
    exists: Boolean(existing),
    isCurrentUser: existing?.userId === session.user.id,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = SubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { endpoint, keys } = parsed.data;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userId: session.user.id,
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userId: session.user.id,
      },
    });

    return new NextResponse(null, { status: 200 });
  } catch (e) {
    console.error("Push subscribe error:", e);
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 }
    );
  }
}

const DeleteBodySchema = z
  .object({
    all: z.literal(true).optional(),
    endpoint: z.string().min(1).optional(),
  })
  .refine((d) => d.all === true || Boolean(d.endpoint?.trim()), {
    message: "Provide all: true or endpoint",
  });

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = DeleteBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { all, endpoint } = parsed.data;

    if (all === true) {
      await prisma.pushSubscription.deleteMany({
        where: { userId: session.user.id },
      });
    } else if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: {
          endpoint,
          userId: session.user.id,
        },
      });
    }

    return new NextResponse(null, { status: 200 });
  } catch (e) {
    console.error("Push unsubscribe error:", e);
    return NextResponse.json(
      { error: "Failed to remove subscription" },
      { status: 500 }
    );
  }
}

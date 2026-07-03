import { NextResponse } from "next/server";
import { processDueMedicalAppointmentsReminders } from "@/lib/medical-appointments-reminder/cycle";

export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDueMedicalAppointmentsReminders();
    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[CRON] medical appointments reminders failed:", e);
    return NextResponse.json(
      { error: "Failed to process medical appointments reminders" },
      { status: 500 }
    );
  }
}

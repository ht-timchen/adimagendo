import { NextResponse } from "next/server";
import { processDueSchoolAttendanceReminders } from "@/lib/school-attendance-reminder/cycle";

export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDueSchoolAttendanceReminders();
    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[CRON] school attendance reminders failed:", e);
    return NextResponse.json(
      { error: "Failed to process school attendance reminders" },
      { status: 500 }
    );
  }
}

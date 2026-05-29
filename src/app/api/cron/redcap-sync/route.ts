import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function parseRedcapDate(val: string): Date | null {
  if (!val || val.trim() === "") return null;
  const d = new Date(val.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

type RedcapFlatRow = Record<string, string | undefined>;

function str(row: RedcapFlatRow, key: string): string {
  const v = row[key];
  return v == null ? "" : String(v).trim();
}

export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiUrl = process.env.REDCAP_API_URL;
  const apiToken = process.env.REDCAP_API_TOKEN;

  if (!apiUrl || !apiToken) {
    return NextResponse.json(
      { error: "REDCap API is not configured" },
      { status: 500 }
    );
  }

  let allRows: RedcapFlatRow[];
  try {
    const fields = [
      "record_id",
      "consent_firstname_over18",
      "consent_lastname_over18",
      "consent_email_over18",
      "consent_dob_over18",
      "consent_sigdatetime_over18",
      "econsent_over_18_complete",
      "consent_firstname_u18",
      "consent_lastname_u18",
      "consent_email_u18",
      "consent_dob_u18",
      "consent_sigdatetime_u18",
      "econsent_u18_complete",
      "econsent_parent_complete",
    ];

    const body = new URLSearchParams({
      token: apiToken,
      content: "record",
      format: "json",
      type: "flat",
    });
    fields.forEach((field, index) => {
      body.append(`fields[${index}]`, field);
    });

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("REDCap error body:", errorText);
      return NextResponse.json(
        { error: `REDCap API returned ${response.status}`, detail: errorText },
        { status: 502 }
      );
    }

    const json = (await response.json()) as unknown;
    if (!Array.isArray(json)) {
      return NextResponse.json(
        { error: "Unexpected REDCap response format" },
        { status: 502 }
      );
    }
    allRows = json as RedcapFlatRow[];
  } catch (e) {
    console.error("REDCap fetch error:", e);
    return NextResponse.json({ error: "Failed to fetch from REDCap" }, { status: 502 });
  }

  const baselineRows = allRows.filter(
    (row) => str(row, "redcap_event_name") === "baseline_arm_1"
  );

  let synced = 0;
  let skipped = 0;

  for (const row of baselineRows) {
    const recordId = str(row, "record_id");
    if (!recordId) {
      skipped += 1;
      continue;
    }

    let redcapType: "over18" | "u18" | null = null;
    let firstName = "";
    let lastName = "";
    let email = "";
    let dateOfBirth: Date | null = null;
    let enrollmentDate: Date | null = null;

    const over18Complete = str(row, "econsent_over_18_complete") === "2";
    const over18Sig = str(row, "consent_sigdatetime_over18");
    const u18Complete = str(row, "econsent_u18_complete") === "2";
    const u18Sig = str(row, "consent_sigdatetime_u18");

    if (over18Complete && over18Sig !== "") {
      redcapType = "over18";
      firstName = str(row, "consent_firstname_over18");
      lastName = str(row, "consent_lastname_over18");
      email = str(row, "consent_email_over18");
      dateOfBirth = parseRedcapDate(str(row, "consent_dob_over18"));
      enrollmentDate = parseRedcapDate(over18Sig);
    } else if (
      u18Complete &&
      u18Sig !== "" &&
      str(row, "econsent_parent_complete") === "2"
    ) {
      redcapType = "u18";
      firstName = str(row, "consent_firstname_u18");
      lastName = str(row, "consent_lastname_u18");
      email = str(row, "consent_email_u18");
      dateOfBirth = parseRedcapDate(str(row, "consent_dob_u18"));
      enrollmentDate = parseRedcapDate(u18Sig);
    } else {
      skipped += 1;
      continue;
    }

    if (!enrollmentDate) {
      skipped += 1;
      continue;
    }

    await prisma.redcapParticipantSync.upsert({
      where: { studyRecordId: recordId },
      update: {
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        dateOfBirth,
        enrollmentDate,
        redcapType,
        consentStatus: "complete",
      },
      create: {
        studyRecordId: recordId,
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        dateOfBirth,
        enrollmentDate,
        redcapType,
        consentStatus: "complete",
      },
    });

    synced += 1;
  }

  return NextResponse.json({
    synced,
    skipped,
    timestamp: new Date(),
  });
}

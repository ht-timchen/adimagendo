import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { classifyRedcapSyncFromStudyRecordId } from "@/lib/participant/participant-data-classification";

function parseRedcapDate(val: string): Date | null {
  if (!val || val.trim() === "") return null;
  const d = new Date(val.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

type RedcapFlatRow = Record<string, string | undefined>;

type RedcapSyncClassification = "over18" | "u18" | "skipped";

/** Study eligibility band derived from DOB (14–25 target range). */
type AgeBand = "14-17" | "18-25" | "under_14" | "over_25" | "unknown";

const STUDY_MIN_AGE = 14;
const STUDY_MAX_AGE = 25;

type RedcapRowDebug = {
  recordId: string;
  eventName: string;
  u18Complete: string;
  u18Sig: string;
  parentComplete: string;
  parentSig: string;
  u18Email: string;
  over18Complete: string;
  over18Sig: string;
  dateOfBirth: string | null;
  age: number | null;
  ageBand: AgeBand;
  classification: RedcapSyncClassification;
  skipReason: string | null;
};

function str(row: RedcapFlatRow, key: string): string {
  const v = row[key];
  return v == null ? "" : String(v).trim();
}

function rowDebugFields(
  row: RedcapFlatRow,
  ageContext?: { dateOfBirth: Date | null; age: number | null; ageBand: AgeBand }
): Omit<RedcapRowDebug, "classification" | "skipReason"> {
  return {
    recordId: str(row, "record_id"),
    eventName: str(row, "redcap_event_name"),
    u18Complete: str(row, "econsent_u18_complete"),
    u18Sig: str(row, "consent_sigdatetime_u18"),
    parentComplete: str(row, "econsent_parent_complete"),
    parentSig: str(row, "consent_sigdatetime_parent"),
    u18Email: str(row, "consent_email_u18"),
    over18Complete: str(row, "econsent_over_18_complete"),
    over18Sig: str(row, "consent_sigdatetime_over18"),
    dateOfBirth: ageContext?.dateOfBirth?.toISOString() ?? null,
    age: ageContext?.age ?? null,
    ageBand: ageContext?.ageBand ?? "unknown",
  };
}

function ageAtDate(dob: Date, reference: Date): number {
  let age = reference.getFullYear() - dob.getFullYear();
  const monthDiff = reference.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

function resolveDateOfBirth(row: RedcapFlatRow): Date | null {
  return (
    parseRedcapDate(str(row, "consent_dob_u18")) ??
    parseRedcapDate(str(row, "consent_dob_over18"))
  );
}

function ageBandFromAge(age: number): AgeBand {
  if (age < STUDY_MIN_AGE) return "under_14";
  if (age < 18) return "14-17"; // 14 <= age < 18
  if (age <= STUDY_MAX_AGE) return "18-25"; // 18 <= age <= 25
  return "over_25";
}

function resolveAgeContext(row: RedcapFlatRow): {
  dateOfBirth: Date | null;
  age: number | null;
  ageBand: AgeBand;
} {
  const dateOfBirth = resolveDateOfBirth(row);
  if (!dateOfBirth) {
    return { dateOfBirth: null, age: null, ageBand: "unknown" };
  }

  const ageReference =
    parseRedcapDate(str(row, "consent_sigdatetime_u18")) ??
    parseRedcapDate(str(row, "consent_sigdatetime_over18")) ??
    new Date();

  const age = ageAtDate(dateOfBirth, ageReference);
  return { dateOfBirth, age, ageBand: ageBandFromAge(age) };
}

type ClassifySkipped = {
  classification: "skipped";
  skipReason: string;
  redcapType: null;
  firstName: "";
  lastName: "";
  email: "";
  dateOfBirth: null;
  participantConsentDate: null;
  parentConsentDate: null;
  enrollmentDate: null;
  debug: RedcapRowDebug;
};

function skippedDecision(
  row: RedcapFlatRow,
  skipReason: string,
  ageContext?: { dateOfBirth: Date | null; age: number | null; ageBand: AgeBand }
): ClassifySkipped {
  return {
    classification: "skipped",
    skipReason,
    redcapType: null,
    firstName: "",
    lastName: "",
    email: "",
    dateOfBirth: null,
    participantConsentDate: null,
    parentConsentDate: null,
    enrollmentDate: null,
    debug: {
      ...rowDebugFields(row, ageContext),
      classification: "skipped",
      skipReason,
    },
  };
}

function logRedcapSyncDecision(debug: RedcapRowDebug): void {
  console.log("[REDCap sync debug]", JSON.stringify(debug));
}

function hasU18Signal(row: RedcapFlatRow): boolean {
  const base = rowDebugFields(row);
  return (
    base.u18Complete !== "" ||
    base.u18Sig !== "" ||
    base.u18Email !== "" ||
    base.parentComplete !== ""
  );
}

function parseParentConsentDate(row: RedcapFlatRow): Date | null {
  return parseRedcapDate(str(row, "consent_sigdatetime_parent"));
}

function calculateEnrolmentDate(
  redcapType: "u18" | "over18",
  participantConsentDate: Date,
  parentConsentDate: Date | null
): Date {
  if (redcapType === "over18") return participantConsentDate;
  if (parentConsentDate && parentConsentDate.getTime() > participantConsentDate.getTime()) {
    return parentConsentDate;
  }
  return participantConsentDate;
}

function classifyBaselineRow(row: RedcapFlatRow): {
  classification: RedcapSyncClassification;
  skipReason: string | null;
  redcapType: "over18" | "u18" | null;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: Date | null;
  participantConsentDate: Date | null;
  parentConsentDate: Date | null;
  enrollmentDate: Date | null;
  debug: RedcapRowDebug;
} {
  const recordId = str(row, "record_id");
  if (!recordId) {
    return skippedDecision(row, "missing record_id");
  }

  const ageContext = resolveAgeContext(row);

  if (!ageContext.dateOfBirth) {
    return skippedDecision(
      row,
      "missing date of birth (consent_dob_u18 and consent_dob_over18 are empty or invalid)",
      ageContext
    );
  }

  if (ageContext.ageBand === "under_14") {
    return skippedDecision(
      row,
      `age ${ageContext.age} is below study minimum (${STUDY_MIN_AGE})`,
      ageContext
    );
  }

  if (ageContext.ageBand === "over_25") {
    return skippedDecision(
      row,
      `age ${ageContext.age} is above study maximum (${STUDY_MAX_AGE})`,
      ageContext
    );
  }

  const over18Complete = str(row, "econsent_over_18_complete") === "2";
  const over18Sig = str(row, "consent_sigdatetime_over18");
  const u18Complete = str(row, "econsent_u18_complete") === "2";
  const u18Sig = str(row, "consent_sigdatetime_u18");
  const parentComplete = str(row, "econsent_parent_complete") === "2";

  if (ageContext.ageBand === "14-17") {
    if (over18Complete && over18Sig !== "") {
      console.warn(
        `[REDCap sync] record ${recordId}: age ${ageContext.age} (14-17 band) has complete over18 consent; ignoring over18 path`
      );
    }

    const skipReasons: string[] = [];
    if (!u18Complete) {
      skipReasons.push(
        `econsent_u18_complete is "${str(row, "econsent_u18_complete") || "(empty)"}", expected "2"`
      );
    }
    if (u18Sig === "") {
      skipReasons.push("consent_sigdatetime_u18 is empty");
    }
    if (!parentComplete) {
      skipReasons.push(
        `econsent_parent_complete is "${str(row, "econsent_parent_complete") || "(empty)"}", expected "2"`
      );
    }

    if (skipReasons.length > 0) {
      return skippedDecision(
        row,
        `age band 14-17: ${skipReasons.join("; ")}`,
        ageContext
      );
    }

    const participantConsentDate = parseRedcapDate(u18Sig);
    if (!participantConsentDate) {
      return skippedDecision(
        row,
        "age band 14-17: consent_sigdatetime_u18 is not a valid date",
        ageContext
      );
    }

    const parentConsentDate = parseParentConsentDate(row);
    if (!parentConsentDate) {
      const parentSigRaw = str(row, "consent_sigdatetime_parent");
      const reason = parentComplete
        ? parentSigRaw === ""
          ? "age band 14-17: econsent_parent_complete is 2 but consent_sigdatetime_parent is empty"
          : `age band 14-17: consent_sigdatetime_parent is not a valid date ("${parentSigRaw}")`
        : "age band 14-17: consent_sigdatetime_parent is missing or invalid";
      return skippedDecision(row, reason, ageContext);
    }

    const dateOfBirth =
      parseRedcapDate(str(row, "consent_dob_u18")) ?? ageContext.dateOfBirth;
    const enrollmentDate = calculateEnrolmentDate(
      "u18",
      participantConsentDate,
      parentConsentDate
    );

    return {
      classification: "u18",
      skipReason: null,
      redcapType: "u18",
      firstName: str(row, "consent_firstname_u18"),
      lastName: str(row, "consent_lastname_u18"),
      email: str(row, "consent_email_u18"),
      dateOfBirth,
      participantConsentDate,
      parentConsentDate,
      enrollmentDate,
      debug: {
        ...rowDebugFields(row, ageContext),
        classification: "u18",
        skipReason: null,
      },
    };
  }

  // age band 18-25
  const skipReasons: string[] = [];
  if (!over18Complete) {
    skipReasons.push(
      `econsent_over_18_complete is "${str(row, "econsent_over_18_complete") || "(empty)"}", expected "2"`
    );
  }
  if (over18Sig === "") {
    skipReasons.push("consent_sigdatetime_over18 is empty");
  }

  if (skipReasons.length > 0) {
    return skippedDecision(
      row,
      `age band 18-25: ${skipReasons.join("; ")}`,
      ageContext
    );
  }

  const participantConsentDate = parseRedcapDate(over18Sig);
  if (!participantConsentDate) {
    return skippedDecision(
      row,
      "age band 18-25: consent_sigdatetime_over18 is not a valid date",
      ageContext
    );
  }

  const dateOfBirth =
    parseRedcapDate(str(row, "consent_dob_over18")) ?? ageContext.dateOfBirth;

  return {
    classification: "over18",
    skipReason: null,
    redcapType: "over18",
    firstName: str(row, "consent_firstname_over18"),
    lastName: str(row, "consent_lastname_over18"),
    email: str(row, "consent_email_over18"),
    dateOfBirth,
    participantConsentDate,
    parentConsentDate: null,
    enrollmentDate: participantConsentDate,
    debug: {
      ...rowDebugFields(row, ageContext),
      classification: "over18",
      skipReason: null,
    },
  };
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
      "consent_sigdatetime_parent",
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

  console.log("[REDCap sync debug] fetched:", {
    totalRows: allRows.length,
    baselineRows: baselineRows.length,
    u18SignalRows: allRows.filter(hasU18Signal).length,
  });

  for (const row of allRows) {
    if (str(row, "redcap_event_name") === "baseline_arm_1") continue;
    if (!hasU18Signal(row)) continue;

    const ageContext = resolveAgeContext(row);
    const skipReason = `event is "${str(row, "redcap_event_name") || "(empty)"}", expected baseline_arm_1`;
    logRedcapSyncDecision({
      ...rowDebugFields(row, ageContext),
      classification: "skipped",
      skipReason,
    });
  }

  let synced = 0;
  let skipped = 0;

  for (const row of baselineRows) {
    const decision = classifyBaselineRow(row);
    logRedcapSyncDecision(decision.debug);

    if (decision.classification === "skipped") {
      skipped += 1;
      continue;
    }

    const {
      redcapType,
      firstName,
      lastName,
      email,
      dateOfBirth,
      participantConsentDate,
      parentConsentDate,
      enrollmentDate,
    } = decision;

    await prisma.redcapParticipantSync.upsert({
      where: { studyRecordId: decision.debug.recordId },
      update: {
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        dateOfBirth,
        participantConsentDate,
        parentConsentDate,
        enrollmentDate,
        redcapType,
        consentStatus: "complete",
      },
      create: {
        studyRecordId: decision.debug.recordId,
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        dateOfBirth,
        participantConsentDate,
        parentConsentDate,
        enrollmentDate,
        dataKind: classifyRedcapSyncFromStudyRecordId(decision.debug.recordId),
        redcapType,
        consentStatus: "complete",
      },
    });

    synced += 1;
  }

  console.log("[REDCap sync debug] summary:", {
    synced,
    skipped,
    baselineRows: baselineRows.length,
  });

  return NextResponse.json({
    synced,
    skipped,
    timestamp: new Date(),
  });
}

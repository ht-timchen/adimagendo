# ADIMAGENDO System Documentation
> ⚠️ Work in progress — some sections may be incomplete or subject to change.
> Single source of truth for the ADIMAGENDO app.
> Read this file before making any changes to the codebase.
> Last updated: May 2026

---

## 1. Project Overview

**ADIMAGENDO** is a participant-facing digital health app supporting a 4-year longitudinal cohort study on endometriosis.

- **Target cohort**: 400 participants, aged 14–25
- **Study duration**: 4 years (Day 0 to Day 1095)
- **Platform**: Progressive Web App (PWA), Next.js + Prisma + SQLite
- **Deployment**: Railway (short-term), AWS (long-term migration)
- **Data system**: App handles navigation and engagement only. REDCap is the source of truth for all clinical/research data.

---

## 2. Team

| Name | Role |
|---|---|
| Tim Chen | Technical Lead / Supervisor |
| Rachel | Clinical Lead |
| Jodie Avery | Senior Research Fellow |
| Shae | App Concept Lead (StudyBuddy design) |
| Klara Salinger | REDCap Data Manager |
| Sunny (Jie Huang) | App Developer & Project Coordinator |

---

## 3. Architecture Principles

- **App = navigation layer only**. No clinical survey data is stored in the app.
- **REDCap = source of truth** for all survey responses, consent data, and participant records.
- **App stores**: email, passwordHash, role, completion flags, booking info, symptom diary entries (before sync), push subscriptions.
- **REDCap stores**: all survey answers, consent forms, imaging results, blood test results.
- No reconciliation between app and REDCap — data flows one way: App → REDCap.
- REDCap data will not be modified before analysis (confirmed by Jodie Avery, May 2026).
- Klara has added backend restrictions in REDCap to prevent unauthorized data tampering.

---

## 4. Participant Flow

### Phase 1: Recruitment & Screening (Offline)
1. Participant sees sign-up flyer
2. Study coordinator screens participant against inclusion/exclusion criteria
3. If eligible → consent process begins

### Phase 2: Consent & Enrollment (Offline)
4. Participant (and parent if aged 14–17) signs consent form in REDCap
5. REDCap automatically assigns a numeric `record_id` at pre-screening survey open
6. Coordinator records formal **enrollment date** in app admin dashboard (Day 0)
7. Coordinator sends download instructions to participant

### Phase 3: App Download & Baseline
8. Participant downloads app
9. Participant creates account using email (email is the linking key between app and REDCap)
10. First task: complete Enrollment Survey (Baseline questionnaire) via REDCap link
11. Coordinator verifies baseline completion in REDCap
12. Coordinator clicks "Mark Baseline Complete" in admin dashboard (unlocks Level 1)

### Phase 4: Level 1 — Guided Flow (Sequential Unlock)
Sequential, condition-driven (not time-based):
1. Complete Enrollment Survey (REDCap link)
2. Book Ultrasound / MRI / Blood Test (external booking links)
3. Pre-TVUS Survey (REDCap link, triggers after Step 2)
4. Confirm Ultrasound Completed (self-report)
5. Post-TVUS Survey (REDCap link, triggers after Step 4)
6. Confirm Blood Test & MRI (self-report + coordinator verified)
→ Level 1 Complete 🎉 (physical reward sent by post)

### Phase 5: Level 2 — Time-based Surveys
All triggered by Days from enrollment date:
- Day 90: 3-month survey
- Day 180: 6-month survey
- Day 270: 9-month survey
- Day 360: 12-month survey

### Phase 6: Level 3 — Long-term Follow-up
- Day 730: 24-month survey
- Day ~912: Book Ultrasound & MRI (2nd imaging)
- Day 1095: Confirm Ultrasound Completed
- Day 1095: Confirm MRI Completed
- Day 1095: 36-month survey
→ Level 3 Complete 🎉 (physical reward sent by post)

**Total checklist items: 15 across all levels** (pending Shae written confirmation)

**Note**: 48-month data collection is NOT confirmed. Study ends at 36 months.

---

## 5. Business Rules

### Age & Consent
- Participants aged 14–17: require **both** participant consent AND parental consent
- Participants aged 18–25: participant consent only
- Consent and screening happen **before** app download — app does not participate in this phase
- Only participants who have completed consent will be imported into the app

### Enrollment Date
- Day 0 = formal enrollment date, manually entered by coordinator in admin dashboard
- This date drives ALL Level 2 & 3 survey due dates
- NOT the same as account registration time

### Due Date Calculation

**Formula**: `dueDate = enrollmentDate + dueOffsetDays`

**Day 0**: `consent_sigdatetime` from REDCap (over 18: 
`consent_sigdatetime_over18`, under 18: `consent_sigdatetime_u18`)
Stored as `ParticipantProfile.enrollmentDate`.

**Offset stored on**: `ChecklistTemplate.dueOffsetDays` (not per-participant)
**Calculated at**: render time in checklist page (not stored in DB)

#### Level 1 — Event triggers + 8-week coordinator follow-up
| Step | Unlock trigger | Participant display |
|---|---|---|
| Book ultrasound → Pre-TVUS | `book_ultrasound` completed | Hint before US appointment |
| Ultrasound done → Post-TVUS | `ultrasound_completed` completed | Recommended within **7 days** after US complete |
| Blood / MRI confirm | `book_bloods` / `book_mri` only (not blocked by Post-TVUS) | — |
| Coordinator follow-up | — | Admin **Follow-up due** if Level 1 incomplete **56 days** after `ParticipantProfile.enrollmentDate` |

`enrollmentDate` on profile: prefer **REDCap consent/enrolment** from `RedcapParticipantSync` at magic-link enrol; fallback app signup time. Open registration still uses signup time.

56 days is **display-only** for coordinators (no auto-`OVERDUE`, no TVUS unlock). Level 1 must be completed before Day 90 (3-month survey unlock).

#### Level 2 — Time-based
| Step | dueOffsetDays |
|---|---|
| 3-month survey | 90 |
| 6-month survey | 180 |
| 9-month survey | 270 |
| 12-month survey | 360 |

#### Level 3 — Time-based
| Step | dueOffsetDays |
|---|---|
| 24-month survey | 730 |
| 2.5yr Book Appointment | 912 |
| 3yr Ultrasound Completed | 1095 |
| 3yr MRI Completed | 1095 |
| 36-month survey | 1095 |

**Note**: `unlockOffsetDays` (dev branch only) controls when a step 
becomes available — separate from due date display. Timed surveys 
have both set to the same value (e.g. 90, 180...). Level 1 steps 
have `unlockOffsetDays: 0` (available immediately, sequential 
locking handled by workflow engine).

### Participant Account Creation
- **Phase 1 (current)**: Coordinator exports CSV from REDCap (email + record_id), uploads to admin dashboard. App matches by email and creates accounts.
- **Phase 2 (future)**: Automated via REDCap API once token is stable.
- Email is the linking key between app and REDCap.

### REDCap record_id Mapping
- REDCap assigns `record_id` when participant opens Pre-Screening Survey
- `record_id` is immutable (Klara removed rename permissions for all users)
- App stores `redcapRecordId Int? @unique` on User model
- Mapping is set once at onboarding and never recalculated

### Survey Completion
- Participants manually mark surveys as complete in app (Phase 1)
- Phase 2: API auto-sync of completion status from REDCap Survey Queue
- REDCap Survey Queue already configured by Klara with all time offsets (Baseline → 36 months)

### Symptom Diary Sync
- App pushes unsynced diary entries to REDCap nightly via cron job
- Endpoint: POST /api/sync/symptom-diary (protected by CRON_SECRET)
- Logic: Export max instance from REDCap → assign new instances → Import CSV
- Fields tracked: syncedToRedcap (Boolean), syncedAt (DateTime)
- No reconciliation needed (REDCap data locked before analysis)

### Notifications
- Push notifications: survey reminders, milestone alerts
- 3-month post-intervention participant interviews: app sends push reminder
- Parent interview reminders: coordinator handles via email (not app)
- Broadcast notifications: /dashboard/admin/actions/notify
- Individual notifications: per-row "Notify" button in participants table

### Completion Rewards
- Physical rewards sent by post at end of each Level
- Mailing addresses collected at enrollment in REDCap
- Notification process for reward dispatch: TBC with Jodie

### Participants Who Don't Use App
- Handled case-by-case by coordinator
- No app changes required

### Notifications

**Requirement**: "Notifications to be sent when things are needed" (Shae, requirements list)
This requirement is written from the study team's perspective — notifications should be sent 
automatically at the right moment, not triggered manually by participants.

#### Web Push Architecture
- Participant devices receive push alerts via Web Push API (service worker + PushSubscription)
- Each device registers independently; subscription stored in DB linked to user account
- VAPID keys required: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_MAILTO
- Push works on mobile Chrome/Safari (PWA installed); may not work on all desktop browsers

#### Opt-in UX (important design decision)
- Browser permission dialog is technically unavoidable (browser security requirement)
- Do NOT show a standalone "Enable Notifications" card on the dashboard
- Trigger the permission request at a contextually relevant moment:
  - On first login, OR
  - When the first checklist item unlocks, OR
  - When a survey due date is approaching
- Rationale: requirement says notifications should "be sent when needed" — 
  opt-in should feel natural, not like a feature the user has to discover themselves

#### Admin-side Controls
- Per-participant push: "Send Notification" button per row in /dashboard/admin/participants
  → calls POST /api/push/send
- Broadcast push: /dashboard/admin/actions/notify
  → sends to all opted-in participants

#### Notification Types
| Type | Trigger | Status |
|---|---|---|
| Survey due reminder | X days before due date (Day 90/180/270/360/730/1095) | ❌ Not yet implemented |
| Level complete | When participant completes final item in a level | ❌ Not yet implemented |
| Appointment reminder | Day before scheduled appointment | ❌ Deferred (no scheduledStartAt) |
| Admin broadcast | Manual send from notify page | ✅ Implemented |
| Per-participant | Manual send from participants table | ✅ Implemented |

#### Separate from In-app Notifications
- Admin broadcast (notify page) creates Notification records in DB (in-app feed)
- Web Push is the optional device-level layer on top
- Participants only receive tray alerts if they have opted in AND admin sends via push API

#### Not in scope
- Email notifications (coordinator handles via REDCap)
- Parent interview reminders (coordinator handles directly)
- Automatic push for appointment reminders (deferred until external booking 
  system provides webhook or API)
  
### Booking Appointments (Level 1 — Task 6)

**Requirement**: "A link to booking system for SIP availability to book in time"
**Status**: ✅ Fully implemented and locally verified (May 2026)

#### UI Structure
`ChecklistBookingGroupCard` renders three independent rows under one 
"Book appointments" group card:
- Ultrasound (SIP appointment)
- MRI (Benson Radiology)
- Blood Test

Each row uses `ChecklistExternalBookingFlow` independently.

#### Booking Flow (per row)

#### Add to Calendar
- Only shown when appointment status === CONFIRMED and scheduledStartAt is set
- iOS limitation: app cannot verify if user completed the final 
  "Add to Calendar" action inside native calendar preview
- Implementation: src/lib/study-appointment-ics.ts + 
  src/components/add-to-calendar-button.tsx

#### Key API Routes
| Route | Purpose |
|---|---|
| POST /api/checklist/book-externally | Sets BOOKED_EXTERNALLY after Book Now |
| POST /api/appointments/confirm | Confirms date/time, creates Appointment row |
| POST /api/checklist/complete | Generic complete; blocks if not CONFIRMED |

#### Data Model Notes
- scheduledStartAt: DateTime? on Appointment — participant-confirmed slot
- bookingProgress: NOT_STARTED → BOOKED_EXTERNALLY → CONFIRMED
- All three booking rows (Ultrasound/MRI/Blood) must be CONFIRMED 
  before checklist group is considered complete
- No appointmentDate or bookingDate fields exist (do not add)

---

## 6. Database Schema (Key Models)

```prisma
model User {
  id             String   @id @default(cuid())
  email          String   @unique
  passwordHash   String?
  name           String?
  role           Role     @default(PARTICIPANT)
  redcapRecordId Int?     @unique  // REDCap record_id mapping
  dateOfBirth    DateTime?
  active         Boolean  @default(true)
  superAdmin     Boolean  @default(false)
  image          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model SymptomEntry {
  id             String   @id @default(cuid())
  userId         String
  date           DateTime
  symptoms       Json     // array of symptom labels
  painLevel      Int      // 0–10 (mapped to 0–100 for REDCap)
  notes          String?
  syncedToRedcap Boolean  @default(false)
  syncedAt       DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  user           User     @relation(fields: [userId], references: [id])
}

enum Role {
  PARTICIPANT
  ADMIN
}
```

---

## 7. REDCap Integration

### API Endpoint
```
POST https://surveys.adelaide.edu.au/redcap/api/
```

### Credentials
- API token: stored in `.env` as `REDCAP_API_TOKEN` (never commit)
- Access: Sunny + Klara only
- REDCap API specialist: Marian (Intersect, Adelaide University)

### Symptom Diary Field Mapping
| App field | REDCap field | Notes |
|---|---|---|
| participant.redcapRecordId | record_id | numeric |
| — | redcap_event_name | hardcode "final_data_arm_1" |
| — | redcap_repeat_instrument | hardcode "symptom_diary" |
| — | redcap_repeat_instance | dynamic, query REDCap MAX+1 |
| — | redcap_survey_identifier | leave empty |
| createdAt | symptom_diary_timestamp | YYYY-MM-DD HH:mm |
| date | symptom_date | YYYY-MM-DD |
| symptoms["pain"] | symptom_choice___1 | 0 or 1 |
| symptoms["nausea"] | symptom_choice___2 | 0 or 1 |
| painLevel × 10 | symptom_vas | 0–100 |
| notes | symptom_notes | |
| — | symptom_diary_complete | hardcode 2 |

### REDCap Events
baseline_arm_1, 3_months_arm_1, 6_months_arm_1, 9_months_arm_1,
12_months_arm_1, 24_months_arm_1, 36_months_arm_1, final_data_arm_1

### REDCap Instruments (key ones)
- prescreening_survey
- econsent_over_18 / econsent_u18 / econsent_parent
- demographics
- health
- pretvus / posttvus
- symptom_diary (repeating instrument)
- completion_data (study personnel only)

---

## 8. Admin Dashboard

### Access Control
- Role ADMIN or SUPER_ADMIN only
- Participants are redirected to /dashboard (participant view)
- Admin redirect logic in: src/app/(dashboard)/dashboard/page.tsx

### Overview KPI — Checklist Completion Rate

**Definition**: Cohort progress through the 15-step study protocol.

Formula:
  (sum of each participant's completed logical steps) ÷ (enrolled participants × 15)

Example: 3 participants, one at 1/15, two at 0/15 → 1 ÷ 45 ≈ 2%

**Why not raw DB rows**: Early in the study, only a few 
ParticipantChecklistItem rows exist per participant (not all 15). 
Counting completed/total DB rows skews to 100% when e.g. 2 rows exist 
and both are done. This was the original bug.

**UI label**: "Average study steps (15 per participant)" — makes clear 
this is protocol progress, not DB row completion.

**Do not use**: completed DB rows ÷ total DB rows — skews to 100% early on.

**Optional future KPIs** (not yet implemented):
- Mean participant %: average of (each user's completed/15)
- Fully complete participants: count at 15/15 ÷ n
- Weekly trend: tracks logical step completions over time 
  (current trend chart still uses raw row completions per week)

### Admin Pages
| Route | Purpose |
|---|---|
| /dashboard/admin | Clinical overview (KPIs, charts, participant table) |
| /dashboard/admin/participants | Participant list, notify, reset password |
| /dashboard/admin/checklist-completion | Checklist stats per participant |
| /dashboard/admin/news | News post management |
| /dashboard/admin/messages | Contact messages from participants |
| /dashboard/admin/people | Admin user management (Super Admin only) |
| /dashboard/admin/settings | Project settings |
| /dashboard/admin/actions/import | CSV upload for participant mapping |
| /dashboard/admin/actions/export | Export symptom diary CSV |
| /dashboard/admin/actions/notify | Broadcast push notification |
| /dashboard/admin/profile | Current user profile |

### Participant Status Definition
- 🟢 Active: activity within last 7 days
- 🟡 Inactive: no activity for 7–30 days
- 🔴 At Risk: no activity for 30+ days
- ⚫ Withdrawn: role === "WITHDRAWN"

### Time Range Options
Last 7 days / Last 30 days (default) / Last 3 months /
Last 6 months / Last 12 months / All time
Implemented via URL search param: ?range=7d|30d|3m|6m|12m|all

---

## 9. Environment Variables

```env
# Database
DATABASE_URL=file:./dev.db

# Auth
NEXTAUTH_SECRET=...
AUTH_URL=...

# REDCap
REDCAP_API_URL=https://surveys.adelaide.edu.au/redcap/api/
REDCAP_API_TOKEN=...  # never commit

# Cron
CRON_SECRET=...  # never commit

# App
NEXT_PUBLIC_APP_URL=...
```

## Environment Configuration

### AUTH_URL / NEXTAUTH_URL

These two variables must always match the origin users access the app from.
Mixing origins (e.g. localhost + ngrok) breaks magic links and PWA installs.

| Scenario | Value |
|---|---|
| Local dev only | `http://localhost:3000` |
| Mobile / PWA / magic link testing | Current ngrok HTTPS URL |
| Production | Railway or university domain |

**Rules:**
- Magic links, QR codes, and the app must all use the same origin
- ngrok URL changes every restart (free plan) — update .env each time
- Before production deploy: replace with real domain

### TODO (Production)
- [ ] Set AUTH_URL + NEXTAUTH_URL to production domain
- [ ] Set CRON_SECRET to a strong random value
- [ ] Verify REDCAP_API_URL points to production REDCap project

---

## 10. Development Rules

1. **Never commit .env files** — use .env.example only
2. **Never hardcode API tokens** — always use process.env
3. **Always commit after each feature** — `git add . && git commit -m "feat: ..."`
4. **Use feature branches** — push to adimagendo-dev, not main
5. **Run `npx prisma db push`** after any schema change
6. **Run `npx prisma generate`** after schema changes before restarting
7. **Test on Railway dev environment** before pushing to production
8. **No survey data stored in app** — only REDCap links and completion flags

---

## 11. Outstanding Items (as of May 2026)

| Priority | Task | Waiting on |
|---|---|---|
| 🔴 | REDCap API sync code (participant onboarding Phase 2) | API token stable |
| 🔴 | Klara to provide test data for participant mapping | Klara |
| 🟡 | Seed Level 1–3 checklist items (15 steps) | Shae written confirmation |
| 🟡 | Schema: add level + prerequisiteTemplateId | Tim |
| 🟡 | Admin panel: enrollment date + Mark Baseline Complete + CSV upload | Tim |
| 🟡 | Fix enrollmentDate bug (currently set to registration time) | Tim |
| 🟡 | Birthday UI design | Shae |
| 🟡 | Gamification milestone rewards in-app | Shae |
| 🟡 | Logo + mascot + colour scheme assets | Shae |
| 🟢 | Admin checklist bug fixes (Progress N + Current Step) | After seed |
| 🟢 | Push notifications: survey reminders + interview reminders | Jodie/Rachel |
| 🟢 | Resources section | Jodie |
| 🟢 | REDCap Symptom Diary sync Phase 2 (survey completion status) | API token |
| — | Ethics approval | Pending |
| — | AWS migration | Long-term |

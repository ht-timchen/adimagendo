# ADIMAGENDO Study Buddy Agent Instructions

This project is ADIMAGENDO Study Buddy, a research study management and participant engagement platform.

It has two main user surfaces:
- Admin dashboard for study coordinators and the research team.
- Participant app / PWA for research participants.

Current phase:
- Pre-launch / internal testing.
- Assume staging environment unless explicitly told otherwise.
- The goal is to help the research team test core workflows before launch.

Safety rules:
- Never use, generate, log, expose, or invent real participant data.
- Treat participant email, date of birth, REDCap record ID, consent dates, uploaded files, and contact messages as sensitive.
- Use synthetic test data only.
- Never consume a magic link token on a failed DoB verification. The link must remain usable for a correct retry.
- Never modify production configuration, production deployment settings, or production REDCap integration without explicit human approval.
- Do not add secrets, API keys, real REDCap exports, database dumps, or participant uploads to the repository.

Workflow rules:
- Always work on the adimagendo-dev branch. Never push directly to main.
- For REDCap sync, enrolment links, magic links, DOB verification, authentication, participant registration, or app-account-to-REDCap-record linking, first inspect the codebase and produce a plan.
- Do not edit code for sensitive workflows until the plan is approved.
- Preserve REDCap record ID linkage as the research identity link.
- studyRecordId (REDCap record_id) is the single stable research identity that binds the app account to the REDCap record. App login email may differ from the REDCap email on file and should not be used as a research identifier.
- App login email is the authentication credential only. It may differ from the REDCap email on file. studyRecordId is the authoritative research identity for all data linkage.
- ADMIN_CHECKLIST_STEP_TOTAL in src/lib/admin/checklist-progress.ts is hardcoded to 19. Any change to the number of Checklist Template entries in prisma/seed.ts must be manually reflected in this constant.
- Prefer small, reviewable diffs.

Testing rules:
- Every workflow change should include admin dashboard, participant app, and staging regression checks.
- Prefer synthetic fixtures and staging-only examples.
- When reporting risks, distinguish between blocking bugs, high-risk workflow issues, medium usability issues, low-priority polish, and known limitations.

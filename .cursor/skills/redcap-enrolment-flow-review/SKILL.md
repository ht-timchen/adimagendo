---
name: redcap-enrolment-flow-review
description: Use when a task involves REDCap sync, consented participant records, studyRecordId, enrolment links, magic links, DoB verification, participant registration, preferred app login email, or linking an app account to a REDCap record.
---

# REDCap Enrolment Flow Review Skill

## Purpose

Use this skill to review any proposed change that touches the ADIMAGENDO Study Buddy REDCap enrolment workflow.

This is a review and planning skill. Do not edit code unless the user explicitly approves the plan.

## Required context

Before reviewing or planning, read:

- AGENTS.md
- context/redcap-enrolment-workflow.md

## Core principles

- studyRecordId is the authoritative research identity.
- App login email is an authentication credential only.
- App login email may differ from the REDCap email on file.
- Do not link research data by email.
- Do not accept client-provided studyRecordId during registration.
- A failed DoB verification must not consume a magic link token.
- usedAt should only be set after successful DoB verification and successful account/profile creation.
- Use synthetic test data only.
- Assume staging unless explicitly told otherwise.

## Review process

For any relevant task, first produce a plan with these sections:

1. Scope
2. Relevant files
3. Current behavior
4. Expected behavior
5. Identity and data linkage
6. Magic link and DoB safety
7. PII and logging
8. Risks
9. Regression tests
10. Proposed implementation

Do not edit files until the user approves.

## Required checks

When reviewing a relevant change, check:

- whether studyRecordId remains the research identity;
- whether app login email is used only for authentication;
- whether failed DoB verification leaves the token usable;
- whether token creation, expiry, regeneration, use, and failed DoB behavior are safe;
- whether participant email, DoB, REDCap record ID, consent dates, uploads, or messages may be exposed;
- whether admin dashboard, participant app, and staging regression checks are included.

## Red flags

Stop and ask for human approval if any task may:

- touch production REDCap integration;
- modify auth or magic link consumption logic;
- change DoB verification behavior;
- change studyRecordId linkage;
- use real participant data;
- log sensitive participant information;
- add new dependencies;
- run migrations;
- deploy or push to a remote branch.

## Output format

Before making any code change, output:

- Scope
- Relevant files
- Current behavior
- Expected behavior
- Identity and data linkage
- Magic link and DoB safety
- PII and logging
- Risks
- Regression tests
- Proposed implementation

End with:

Waiting for approval before editing files.

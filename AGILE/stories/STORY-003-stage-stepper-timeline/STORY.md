# STORY-003 — Stage Stepper, Timeline, and Artifacts Gate

## Summary
Create the project detail scaffolding: six-stage stepper, current stage panel container, artifact upload enforcement (≥2 files) with storage abstraction, and transition timeline logging approvals/notes.

## Business Value
Visually communicates progress, enforces governance, and provides audit trail demanded in PRD success metrics.

## Requirements
- Build React stepper component with states: completed, current, locked, referencing stage metadata.
- Implement artifact uploader backed by Supabase storage buckets (keep adapter interface S3-ready) and validation preventing stage advancement until ≥2 files exist.
- Persist timeline entries containing timestamp, actor, stage, action, notes.
- Provide Approve/Advance buttons with confirmation modal using AGUI pattern.
- Update `PATCH /api/estimates/:id` to capture approvals + transitions.

## Acceptance Criteria
- Stepper highlights correct stage, disables later stages until prerequisites satisfied.
- Timeline auto-updates when approvals happen, even from parallel Copilot actions (shared state test).
- Uploading files stores metadata + Supabase storage path; validation error appears if user attempts to advance prematurely.

## Dependencies
- STORY-002 (navigating into detail view).
- STORY-001 (shared state + storage infra readiness).

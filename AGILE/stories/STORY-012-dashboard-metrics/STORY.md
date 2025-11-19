# STORY-012 — Dashboard Metrics & Documentation Finish

## Summary
Create the landing dashboard with two cards (Estimates, Contracts) showing record counts + last updated timestamps, ensure `/api/dashboard/metrics` aggregates data, and finish documentation/testing deliverables.

## Business Value
Provides exec-friendly overview and completes PRD deliverables (docs, tests, Loom demo).

## Requirements
- Backend endpoint `/api/dashboard/metrics` returning counts + ISO timestamps for both workflows from Supabase.
- Frontend cards with formatted relative timestamps and links to `/estimates` and `/contracts`.
- Trigger revalidation when quotes/contracts change (websocket/shared state or SWR mutation) so Supabase updates propagate within seconds.
- Expand `README`, `APPROACH`, `AI_ARTIFACTS`, `TESTING`, `.env.example`, and record Loom demo link.
- Add ≥3 automated tests (proposal apply, copilot action, estimate generation) documented in `TESTING.md`.

## Acceptance Criteria
- Dashboard loads within 1s and reflects seeded data accurately.
- Documentation covers setup, docker, Supabase provisioning, seeding, testing, Loom instructions; reviewers can follow without clarifications.
- Tests executable via `uv run pytest` (or chosen harness) and referenced in docs.

## Dependencies
- STORY-001 (ops), STORY-005/006/007/008/011 for data + Copilot instrumentation.

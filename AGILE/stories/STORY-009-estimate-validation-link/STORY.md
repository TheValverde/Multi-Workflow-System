# STORY-009 — SOW ↔ Estimate Link & Discrepancy Report

## Summary
Allow contracts to link a SOW to an estimate, fetch WBS + quote data, and display discrepancies (missing tasks, payment term mismatches, hour deltas) inline.

## Business Value
Prevents misalignment between signed agreements and approved estimates, satisfying PRD validation requirements.

## Requirements
- UI control on agreement detail to select an estimate (autocomplete/search from `/api/estimates`) backed by Supabase queries.
- Backend endpoint `/api/contracts/:id/validate` that compares agreement clauses to WBS + quote data stored in Supabase.
- Result view surfaces discrepancies grouped by category (scope, hours, payment terms) with severity tags.
- Copilot action `validate_against_estimate` triggers same flow and posts summary to notes.
- Validation history logged in version timeline stored in Supabase.

## Acceptance Criteria
- SOW cannot be marked ready for signature unless validation passes or override rationale logged.
- Discrepancies show actionable text referencing offending clause/task.
- API covered by automated test verifying detection of mismatched payment terms.

## Dependencies
- STORY-005/006 (WBS/quote data), STORY-008 (agreement detail UI).

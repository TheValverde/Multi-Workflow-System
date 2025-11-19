# STORY-006 — Quote Stage Export & Delivery Flag

## Summary
Finish the Quote stage: rate application UI, payment terms inputs, timeline, CSV export/copy, and "mark delivered" switch for downstream auditing.

## Business Value
Completes the estimations workflow and provides the financial artifact that kicks off contract work.

## Requirements
- Rate table allowing per-role or per-task rate overrides and total calculations.
- Inputs for payment terms + delivery timeline; data persisted to Supabase project tables.
- CSV export endpoint (`GET /api/estimates/:id/export`) and clipboard copy fallback powered by Supabase queries.
- "Mark delivered" toggle logging timestamp + actor in Supabase; required before linking to Contracts.
- Update dashboard metrics when quotes change to refresh last updated timestamp.

## Acceptance Criteria
- Exported CSV includes header row, WBS tasks, computed cost, payment terms.
- Total matches `get_project_total` Copilot tool output.
- Delivery flag prevents edits after marked (except via admin override).

## Dependencies
- STORY-005 (WBS data) and STORY-010 (Copilot totals tool).

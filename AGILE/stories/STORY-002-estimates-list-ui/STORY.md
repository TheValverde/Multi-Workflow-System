# STORY-002 — Estimates Projects List & Filters

## Summary
Implement the `/estimates` list screen per `features/estimates_workflow`, showing all projects with stage pills, owners, timestamps, and a stage filter while fetching data from `GET /api/estimates`.

## Business Value
Gives users and demo viewers a clear entry point to any project, aligning with dashboard navigation requirements.

## Requirements
- Build API handler and data layer for `GET /api/estimates` returning name, owner, stage, lastUpdated sourced from Supabase.
- React table with stage pill badges (color-coded) and filter dropdown (All + six stages).
- Row click navigates to `/estimates/[id]` detail route.
- Include search or quick filter input for owner/project name if time permits.
- Integrate with shared state context to keep selected project synchronized when navigating from list to detail.

## Acceptance Criteria
- Stage filter updates list client-side or via query parameter without page reload.
- List displays Supabase-seeded projects from STORY-006 data.
- Loading + empty states match AGUI styling; lint/tests pass.

## Dependencies
- STORY-001 (shared state + API scaffolding).

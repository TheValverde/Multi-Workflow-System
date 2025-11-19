# STORY-005 — Effort Estimate WBS & Quote Data APIs

## Summary
Implement the Effort Estimate stage where the LLM produces a Work Breakdown Structure (tasks, roles, hours, assumptions) and expose APIs that Contracts validation will consume.

## Business Value
Provides granular estimation data, enabling quote generation and downstream contract validation per PRD.

## Requirements
- Design WBS schema (task id, description, role, hours, assumptions) stored in Supabase project tables.
- Build LangGraph tool `generate_wbs` leveraging artifacts + prior stage outputs.
- Allow manual edits via Copilot or inline table editing.
- Persist approvals and version history of WBS in Supabase (including actor + timestamp).
- Expose `GET /api/estimates/:id/stage/estimate` returning WBS + metadata for Contracts workflow via Supabase queries.

## Acceptance Criteria
- Generated WBS includes ≥5 tasks across multiple roles for seed project.
- Copilot "adjust hours" and "add line item" actions (from EPIC-003) update WBS immediately.
- API endpoint consumed by STORY-009 returns data with test coverage.

## Dependencies
- STORY-004 (previous stages), STORY-010 (Copilot actions) for full experience.

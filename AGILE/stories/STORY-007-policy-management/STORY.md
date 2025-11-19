# STORY-007 — Policy Management & Exemplar Library

## Summary
Build the policy rules CRUD interface and exemplar ingestion utilities required before drafting agreements, per `features/contracts_workflow`.

## Business Value
Creates the knowledge base that powers agreement generation and automated reviews.

## Requirements
- UI table of policy rules with create/edit/delete modals; data stored via Supabase-backed `GET/POST/PATCH /api/policies`.
- Upload/import exemplars from `RAW_TEXT` folders into Supabase storage, tagging by type (MSA, SOW, NDA).
- Backend helper `load_exemplar_contracts(type)` reused by LangGraph tools.
- Display summary stats (rule count, last updated) feeding dashboard metrics.
- Document policy seeding steps in README + seeds script.

## Acceptance Criteria
- Admin can add ≥3 sample policies and associate them with exemplars.
- API validation prevents duplicate titles and enforces required fields.
- Contracts creation flow consumes stored policies/exemplars (verified in STORY-008).

## Dependencies
- STORY-001 (ops), STORY-006 (quote completion before linking, informational).

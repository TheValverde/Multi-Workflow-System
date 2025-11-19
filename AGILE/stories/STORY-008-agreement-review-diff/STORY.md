# STORY-008 — Agreement Review, Diff, and Versioning

## Summary
Deliver the agreements list/detail UI plus the review workflow that compares client drafts against policy-powered proposals, letting users accept/reject changes to create new versions.

## Business Value
Enables legal reviewers to handle pushbacks quickly and preserves an auditable version timeline aligned with PRD requirements.

## Requirements
- Agreements list with columns: type, counterparty, version, linked estimate badge sourced from Supabase.
- Detail view showing active text (TipTap), version timeline, notes panel.
- Review screen allowing upload/paste of client draft, running `/api/contracts/:id/review`, and displaying proposals with before/after diff + rationale (leveraging `diff` lib) while persisting uploads in Supabase storage.
- Accept/reject controls create new version via `/api/contracts/:id/versions` and update timeline/notes stored in Supabase.
- Shared state ensures Copilot or manual actions refresh UI instantly.

## Acceptance Criteria
- Applying proposal updates agreement content, increments version, and logs rationale.
- Review UI supports at least three simultaneous proposals with independent decisioning.
- Tests cover proposal acceptance pipeline (one of three required backend tests).

## Dependencies
- STORY-007 (policies/exemplars) and STORY-009 (linked estimate data) for full context.

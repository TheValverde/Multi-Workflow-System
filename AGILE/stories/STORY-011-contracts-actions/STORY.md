# STORY-011 — Copilot Tools for Contracts & Cross-Workflow Drafts

## Summary
Implement the required Copilot tools for Contracts (summarize pushbacks, add note, apply proposals) plus the cross-workflow action that creates MSA/SOW from an estimate, ensuring outputs sync to UI immediately.

## Business Value
Unlocks the automated legal workflows promised in PRD and demonstrates cross-workflow orchestration.

## Requirements
- Build LangGraph tool functions per `features/contracts_workflow/requirements.md`.
- `summarize_pushbacks`: analyze latest proposals + notes, return digest posted to chat + notes panel.
- `add_agreement_note`: persist author/timestamped note in Supabase and refresh UI state.
- `apply_proposals`: accepts selection payload, mutates agreement content stored in Supabase, and increments version.
- `create_agreements_from_estimate`: pulls artifacts + WBS/quote to draft new MSA + SOW, storing both and linking automatically in Supabase.
- Include error handling/responses with remediation hints if estimate missing prerequisites.

## Acceptance Criteria
- Each tool callable via natural language command; transcripts saved to `AI_ARTIFACTS.md`.
- Applying proposals through Copilot results in same version/timeline changes as manual path.
- Cross-workflow draft populates both agreements in under 60 seconds with seeded data.

## Dependencies
- STORY-010 (agent shell), STORY-005/006 (estimate data), STORY-007/008 (policies + agreements).

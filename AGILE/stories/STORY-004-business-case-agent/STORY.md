# STORY-004 — Business Case & Requirements Agent Flow

## Summary
Implement the LLM-powered Business Case and Requirements stages, including Copilot-triggered generation, editable TipTap editor, validation gates, and approval storage.

## Business Value
Delivers two of the six estimate stages, showcasing agent-assisted drafting and governance.

## Requirements
- Create backend tools leveraging LangChain/LangGraph to summarize artifacts into Business Case and Requirements sections.
- Surface generated content inside TipTap editor with edit history captured for `AI_ARTIFACTS.md`.
- Provide "Generate with Copilot" action plus manual edit/approval steps, persisting drafts + approvals to Supabase.
- Block progression until approval recorded (Business Case) and validation toggled (Requirements) in Supabase tables.
- Log outputs + approvals to timeline for audit.

## Acceptance Criteria
- Copilot-generated content appears within 5s for seeded data; errors show remediation hints.
- Approve/Validate buttons persist state to Supabase and unlock next stage in stepper.
- Tests cover agent tool invocation success + failure path.

## Dependencies
- STORY-003 (stage container + approvals infrastructure).

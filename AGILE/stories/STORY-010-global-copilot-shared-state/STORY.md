# STORY-010 — Global Copilot Shared State & UI Shell

## Summary
Stand up the Global Copilot agent graph, shared state hook, and UI shell (sidebar + mobile sheet) that keeps workflow/entity context synchronized and streams responses/actions.

## Business Value
Provides the command center for both workflows, fulfilling PRD Copilot expectations.

## Requirements
- Define `GlobalCopilotState` in frontend + backend; integrate via `useCoAgent` with Supabase-sourced entity snapshots.
- Implement LangGraph start/chat/tool nodes with workflow-aware system prompt.
- Build UI components (desktop sidebar, mobile drawer) mirroring AGUI Shared State styling with streaming transcripts and error toasts.
- Ensure navigation updates agent context automatically.
- Log all prompts/responses for `AI_ARTIFACTS.md` and debugging, including Supabase mutation payload references.

## Acceptance Criteria
- Switching between project/agreement updates Copilot header + context in <250ms.
- Mock tool invocation proves shared state updates UI; ready for STORY-011 tool wiring.
- Accessibility: focus management + keyboard shortcuts for opening sidebar.

## Dependencies
- STORY-001 (shared state baseline) + underlying workflows for context data.

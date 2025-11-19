# Create epics and sprints for project setup
_Exported on 11/19/2025 at 04:10:28 EST from Cursor (2.0.77)_

---

**User**

Can you create epics, sprints and stories based on the @PRD.md and @features and place it within@AGILE . Create folders for each with seperate markdowns per thing. Bear in mind that we are to build our work on top of @fs-agent . That folder already contains a next.js project from CopilotKit and a langgraph agent built into it. It currently is not configured for its Shared State version, however we can use CopilotKIt MCP to easily convert the code into that.

---

**Cursor**

## Summary
- Estimates workflow epic now captures six-stage UI/LLM flow, approvals, CSV export, and Copilot hooks grounded in the existing `fs-agent` stack, plus risks/exit criteria for demo readiness.
```1:29:REPO/AGILE/epics/EPIC-001-estimates-workflow/EPIC.md
# EPIC-001 — Estimates Workflow Backbone
- Build the six-stage estimates workflow defined in `PRD.md`, leveraging the existing CopilotKit + LangGraph Next.js app in `fs-agent`.
- Convert the inherited AGUI project into the Shared State pattern so that stage data, approvals, and Copilot actions remain synchronized across clients.
- Provide demo-ready data seeds and validations so the entire workflow can be completed end-to-end within 10 minutes of setup.
...
```
- Contracts workflow epic details policy CRUD, agreement review/versioning, estimate validation, dependencies on estimate data, and mitigation strategies for diff accuracy and linkage.
```1:31:REPO/AGILE/epics/EPIC-002-contracts-workflow/EPIC.md
# EPIC-002 — Contracts Workflow & Policy Engine
Deliver the policy-aware contracts workspace covering policy CRUD, agreement lifecycle (create, review, version), client draft comparison, and estimate validation...
- Policy management dashboard with exemplar ingestion from `RAW_TEXT`.
- Agreement list + detail views exposing version timelines, linked estimate badges, and editable notes.
...
```
- Global Copilot epic defines shared state plumbing, LangGraph plan, ≥7 tools (including cross-workflow drafts), and high-contrast architecture diagram to align with CopilotKit MCP requirements.
```1:33:REPO/AGILE/epics/EPIC-003-global-copilot/EPIC.md
# EPIC-003 — Global Copilot & Shared LangGraph State
Implement the right-rail Copilot that orchestrates actions across the Estimates and Contracts workflows using CopilotKit MCP + LangGraph shared state...
1. **Agent Graph**: LangGraph nodes (start → chat → tool) with workflow-aware system prompt.
2. **Context Sync**: Hooks to update agent state on navigation between `/estimates/*` and `/contracts/*`.
...
```
- Platform/dashboard epic covers uv + Docker ops, port/UFW checks, dashboard metrics, seeds, tests, docs, and Loom deliverable expectations to keep the project dockerizable and demoable.
```1:29:REPO/AGILE/epics/EPIC-004-platform-and-dashboard/EPIC.md
# EPIC-004 — Platform, Dashboard, and Ops Enablement
Stand up the shared infrastructure... environment & ops, dashboard UI, data seeds, testing, docs & Loom.
- Provide `README.md`, `.env.example`, Dockerfiles/compose, UFW/port guidance, and uv virtual environment bootstrapping.
...
```

## Plans & Stories
- Three sprint plans outline sequencing from shared-state foundation through contracts integration to Copilot/dashboard polish, each with backlog, DoD, risks, and gantt timelines.
```1:44:REPO/AGILE/sprints/SPRINT-01-foundation/SPRINT.md
# Sprint 01 — Shared State Foundation & Estimates Core
**Duration**: Week 1 (5 working days)
...
- Running `uv run pnpm dev` ... boots the Next.js UI + agents without manual tweaks.
```
- Twelve implementation stories span ops bootstrap, estimates UI/stages, WBS/quote APIs, policy + review UX, SOW validation, Copilot tools, and dashboard/docs; e.g., STORY-009 specifies linking SOWs to estimates with discrepancy reporting and Copilot validation.
```1:23:REPO/AGILE/stories/STORY-009-estimate-validation-link/STORY.md
# STORY-009 — SOW ↔ Estimate Link & Discrepancy Report
Allow contracts to link a SOW to an estimate... `/api/contracts/:id/validate`, discrepancy grouping, Copilot `validate_against_estimate`, and acceptance criteria blocking signature until resolved.
```

## Next Steps
- Kanban MCP server returned no available resources, so I couldn’t create the requested workspace; once the service exposes project workspaces we should mirror these epics/sprints/stories there for live tracking.
- No code/tests were executed (planning only); next actions are to prioritize Sprint 01 stories, stand up the uv + Docker environment, and begin implementing the estimates workflow while logging progress for future Loom/demo updates.

```plaintext
# EPIC-001 — Estimates Workflow Backbone
- Build the six-stage estimates workflow defined in `PRD.md`, leveraging the existing CopilotKit + LangGraph Next.js app in `fs-agent`.
- Convert the inherited AGUI project into the Shared State pattern so that stage data, approvals, and Copilot actions remain synchronized across clients.
- Provide demo-ready data seeds and validations so the entire workflow can be completed end-to-end within 10 minutes of setup.
...
```

```plaintext
# EPIC-002 — Contracts Workflow & Policy Engine
Deliver the policy-aware contracts workspace covering policy CRUD, agreement lifecycle (create, review, version), client draft comparison, and estimate validation...
- Policy management dashboard with exemplar ingestion from `RAW_TEXT`.
- Agreement list + detail views exposing version timelines, linked estimate badges, and editable notes.
...
```

```plaintext
# EPIC-003 — Global Copilot & Shared LangGraph State
Implement the right-rail Copilot that orchestrates actions across the Estimates and Contracts workflows using CopilotKit MCP + LangGraph shared state...
1. **Agent Graph**: LangGraph nodes (start → chat → tool) with workflow-aware system prompt.
2. **Context Sync**: Hooks to update agent state on navigation between `/estimates/*` and `/contracts/*`.
...
```

```plaintext
# EPIC-004 — Platform, Dashboard, and Ops Enablement
Stand up the shared infrastructure... environment & ops, dashboard UI, data seeds, testing, docs & Loom.
- Provide `README.md`, `.env.example`, Dockerfiles/compose, UFW/port guidance, and uv virtual environment bootstrapping.
...
```

```plaintext
# Sprint 01 — Shared State Foundation & Estimates Core
**Duration**: Week 1 (5 working days)
...
- Running `uv run pnpm dev` ... boots the Next.js UI + agents without manual tweaks.
```

```plaintext
# STORY-009 — SOW ↔ Estimate Link & Discrepancy Report
Allow contracts to link a SOW to an estimate... `/api/contracts/:id/validate`, discrepancy grouping, Copilot `validate_against_estimate`, and acceptance criteria blocking signature until resolved.
```


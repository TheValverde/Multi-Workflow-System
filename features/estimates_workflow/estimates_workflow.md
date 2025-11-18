# Estimates Workflow Feature

## Purpose (from RULES.md)
Structured estimation process through six stages with entry criteria and approval gates.

## Six Stages

### 1. Artifacts
- Create project
- Attach ≥2 artifacts (transcripts, documents, notes)
- Advance when ready

### 2. Business Case
- LLM generates business case from artifacts (scope, outcomes, constraints)
- Edit and approve to advance

### 3. Requirements
- LLM generates requirements summary from artifacts
- Edit and validate to advance

### 4. Solution/Architecture
- Document approach and solution architecture, tech stack, risks
- Approve to advance

### 5. Effort Estimate
- LLM generates WBS with tasks, assigned roles, hours per task, and assumptions
- Approve to advance

### 6. Quote
- Apply rates to roles
- Add payment terms and timeline
- Export CSV or copy-to-clipboard
- Mark delivered

## Must-have Screens (from RULES.md)

### Projects List
- Show all projects with current stage indicator
- Filter by stage

### Project Detail
- Stage stepper/progress indicator at top
- Current stage content panel
- Stage transition history timeline with timestamps/approvers

### Stage Transitions
- Validation before advancing (e.g., artifacts uploaded, approval recorded)
- Clear advance/approve buttons per stage

## Copilot Integration
Commands are context-aware per stage. All edits after LLM generation performed via agent.

**Example commands from RULES.md:**
- "Increase Backend hours by 10%"
- "Add a QA line: 40h at $90/hr, rationale 'regression pass'"
- "What's the current total for Project Apollo?"

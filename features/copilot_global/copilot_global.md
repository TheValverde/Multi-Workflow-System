# Global Copilot Feature

## Purpose (from RULES.md)
Right-side assistant that accepts natural language, reads/writes across workflows, and executes actions. Think of it as the command line for the whole app—fast, context-aware, and consistent.

## Core Requirements
- **Context-aware**: Knows which workflow and entity (project/agreement) you're viewing
- **Cross-workflow**: Can read from one workflow and write to another
- **Action-oriented**: Must call server functions/tools and update UI (no manual refresh)
- **≥6 actions**: Must support at least 6 real actions

## Required Actions from RULES.md

### Estimates Workflow (3 examples given)
1. **Increase hours**: "Increase Backend hours by 10%"
2. **Add line item**: "Add a QA line: 40h at $90/hr, rationale 'regression pass'"
3. **Fetch totals**: "What's the current total for Project Apollo?"

### Contracts Workflow (3 examples given)
1. **Summarize pushbacks**: "Summarize pushbacks on this agreement"
2. **Add notes**: "Add a note: 'Net 45 acceptable with 2% discount'"
3. **Apply proposals**: "Apply the payment-terms proposals and create a new version"

### Cross-Workflow (1 example given, counts as multiple actions)
1. **Create agreements from estimate**: "Create a new MSA and SOW for Project Apollo; use the scope and estimate from the Estimates workflow"
   - Should fetch project's artifacts/estimate
   - Feed them into Contracts LLM prompt
   - Draft appropriate agreements

## Architecture
Built on CopilotKit + LangGraph (same as the AGUI Shared State project pattern):
- Uses `useCoAgent` for shared state
- Agent receives context (workflow, entity_id, entity_type)
- Predictive state updates stream changes to UI
- Confirmation modals for destructive actions

## UI Components

### Desktop
- Right sidebar (similar to the AGUI Shared State project's `CopilotSidebar`)
- Always visible, collapsible

### Mobile
- Pull-up panel from bottom (similar to the AGUI Shared State project's mobile chat)
- Drag handle to resize

## Agent State
```python
class GlobalCopilotState(MessagesState):
    workflow: Optional[str]  # "estimates" | "contracts"
    entity_id: Optional[str]
    entity_type: Optional[str]  # "project" | "agreement"
    entity_data: Optional[dict]
```

## Implementation Notes
- Reuse the AGUI Shared State project's agent structure (start_node → chat_node → tool_node)
- Context updated when user navigates
- All actions must update UI immediately via state sync
- Error handling with inline remediation hints

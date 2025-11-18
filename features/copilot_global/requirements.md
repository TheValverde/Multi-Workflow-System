# Global Copilot Requirements

## Frontend Dependencies
All already in the AGUI Shared State project:
```json
{
  "@copilotkit/react-core": "^1.0.0",
  "@copilotkit/react-ui": "^1.0.0",
  "@ag-ui/langgraph": "latest"
}
```

## Backend Dependencies
Same as the AGUI Shared State project:
```txt
langchain
langchain-openai
langgraph
fastapi
pydantic
```

## Agent Configuration

### LangGraph Setup
```json
{
  "python_version": "3.12",
  "dependencies": ["."],
  "graphs": {
    "global_copilot": "./agent.py:graph"
  },
  "env": ".env"
}
```

### Agent State
```python
class GlobalCopilotState(MessagesState):
    workflow: Optional[str]  # "estimates" | "contracts"
    entity_id: Optional[str]
    entity_type: Optional[str]  # "project" | "agreement"
    entity_data: Optional[dict]
```

## Required Tools (minimum 6)

From RULES.md examples, implement these tools:

### Estimates Tools (3 minimum)
```python
def adjust_hours(project_id: str, role: str, percentage: float) -> dict
def add_line_item(project_id: str, description: str, hours: int, rate: int, rationale: str) -> dict
def get_project_total(project_id: str) -> dict
```

### Contracts Tools (3 minimum)
```python
def summarize_pushbacks(agreement_id: str) -> str
def add_agreement_note(agreement_id: str, note: str) -> dict
def apply_proposals(agreement_id: str, proposal_type: str) -> dict
```

### Cross-Workflow Tool (1 minimum)
```python
def create_agreements_from_estimate(project_id: str, counterparty: str) -> dict
# Creates both MSA and SOW from estimate data
```

## Context Management

### Frontend
```tsx
const { state, setState } = useCoAgent<GlobalCopilotState>({
  name: "global_copilot",
  initialState: {
    workflow: currentWorkflow,
    entity_id: entityId,
    entity_type: entityType
  }
});

// Update when navigation changes
useEffect(() => {
  setState({ workflow, entity_id: entityId, entity_type: entityType });
}, [workflow, entityId, entityType]);
```

### Backend
```python
async def chat_node(state: GlobalCopilotState, config: Optional[RunnableConfig] = None):
    workflow = state.get('workflow')
    entity_id = state.get('entity_id')
    
    system_prompt = f"""
    You are assisting with the {workflow} workflow.
    Current entity: {entity_id}
    
    Available actions:
    {get_actions_for_workflow(workflow)}
    """
    # ... rest of chat node
```

## UI Integration

### Copilot Provider
```tsx
<CopilotKit
  runtimeUrl="/api/copilotkit"
  agent="global_copilot"
>
  {children}
</CopilotKit>
```

### Desktop Sidebar
```tsx
<CopilotSidebar
  defaultOpen={true}
  labels={{
    title: "AI Assistant",
    initial: "How can I help?"
  }}
/>
```

### Mobile Panel
```tsx
<CopilotChat
  className="h-full flex flex-col"
  labels={{ initial: "How can I help?" }}
/>
```

## Implementation Notes
- Reuse the AGUI Shared State project's agent pattern completely
- Context syncs automatically on navigation
- Action confirmations use same modal pattern as document editor
- Error handling with debug logging (like the AGUI Shared State project)
- All tools must update both database and UI state

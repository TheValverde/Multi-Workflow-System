# Estimates Workflow Requirements

## Frontend Dependencies
All already in the AGUI Shared State project:
```json
{
  "@copilotkit/react-core": "^1.0.0",
  "@copilotkit/react-ui": "^1.0.0",
  "@tiptap/react": "^2.0.0",
  "@tiptap/starter-kit": "^2.0.0",
  "diff": "^5.0.0",
  "markdown-it": "^13.0.0"
}
```

## Backend Dependencies
```txt
langchain
langchain-openai
langgraph
fastapi
pydantic
```

## Agent State Schema
```python
class EstimatesState(MessagesState):
    project_id: Optional[str]
    stage: Optional[str]  # artifacts, business_case, requirements, solution, estimate, quote
    project_data: Optional[dict]
    wbs: Optional[List[dict]]
    artifacts: Optional[List[str]]
```

## API Endpoints
- `GET /api/estimates` - List all projects
- `GET /api/estimates/:id` - Get project detail
- `POST /api/estimates` - Create new project
- `PATCH /api/estimates/:id` - Update project
- `GET /api/estimates/:id/stage/:stage` - Get stage data
- `POST /api/estimates/:id/artifacts` - Upload artifacts
- `GET /api/estimates/:id/export` - Export quote as CSV

## Stage Requirements

### 1. Artifacts Stage
- Upload component for file attachments
- Require ≥2 artifacts before advancing
- File storage (local or S3-compatible)

### 2. Business Case Stage
- LLM generates from artifacts
- Editable text field
- Approval required to advance

### 3. Requirements Stage
- LLM generates from artifacts + business case
- Validation gate before advancing

### 4. Solution/Architecture Stage
- Manual or LLM-assisted content
- Approval required

### 5. Effort Estimate Stage
- LLM generates WBS (tasks, roles, hours, assumptions)
- Editable via Copilot actions
- Approval logged

### 6. Quote Stage
- Rate application form
- Payment terms input
- CSV export functionality
- "Mark delivered" flag

## Copilot Actions (Required from RULES.md)
From the examples given:
```python
def adjust_hours(project_id: str, role: str, percentage: float) -> dict
def add_line_item(project_id: str, description: str, hours: int, rate: int, rationale: str) -> dict
def get_project_total(project_id: str) -> dict
```

## UI Components

### Projects List
- Stage filter dropdown
- Table showing: name, stage pill, last updated, owner
- Click through to project detail

### Project Detail
- Stage stepper component (shows all 6 stages)
- Current stage content panel
- Timeline component (transitions with timestamp, actor, notes)
- Advance/Approve buttons with validation

## Implementation Notes
- Reuse `useCoAgent` pattern from the AGUI Shared State project
- Stage stepper shows which stages are complete
- Timeline tracks all transitions
- All LLM edits go through agent for auditability
- Confirmation modals for approvals

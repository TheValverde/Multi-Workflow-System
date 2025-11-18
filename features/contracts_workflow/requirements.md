# Contracts Workflow Requirements

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
class ContractsState(MessagesState):
    agreement_id: Optional[str]
    agreement_type: Optional[str]  # MSA, SOW, NDA
    counterparty: Optional[str]
    content: Optional[str]
    version: Optional[int]
    linked_estimate_id: Optional[str]
    policies: Optional[List[dict]]
    proposals: Optional[List[dict]]  # For review workflow
```

## API Endpoints
- `GET /api/contracts` - List all agreements
- `GET /api/contracts/:id` - Get agreement detail
- `POST /api/contracts` - Create new agreement
- `PATCH /api/contracts/:id` - Update agreement
- `GET /api/contracts/:id/versions` - Get version history
- `POST /api/contracts/:id/versions` - Create new version
- `POST /api/contracts/import` - Import from RAW_TEXT
- `POST /api/contracts/:id/review` - Review client draft
- `GET /api/contracts/:id/validate` - Validate against estimate
- `GET /api/policies` - List policy rules
- `POST /api/policies` - Create policy
- `PATCH /api/policies/:id` - Update policy

## RAW_TEXT Integration
- Read from `RAW_TEXT/MSA/*.md` for MSA exemplars
- Read from `RAW_TEXT/SOW/*.md` for SOW exemplars
- Backend helper: `load_exemplar_contracts(type: str) -> List[str]`

## Copilot Actions (Required)
From RULES.md examples:
1. `summarize_pushbacks` - Summarize policy conflicts
2. `add_note` - Add note to agreement
3. `apply_proposals` - Accept/reject change proposals
4. `create_agreement` - Generate MSA/SOW from policy + exemplars
5. `review_draft` - Compare client draft against policies
6. `validate_against_estimate` - Check SOW vs estimate
7. `create_from_estimate` - Cross-workflow: create MSA/SOW from project (≥6 total)

## Implementation Notes
- Reuse `useCoAgent` pattern from the AGUI Shared State project
- TipTap editor with same extensions as document editor
- Confirmation modals for proposal accept/reject
- Version timeline stored as array in agreement metadata
- Diff algorithm uses `diff` library (same as the AGUI Shared State project)

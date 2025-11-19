# Multi-Workflow System

A web application that unifies **Estimates** and **Contracts** workflows with an AI-powered Copilot assistant. Transform project artifacts into structured estimates, generate and review contracts guided by policies, and orchestrate cross-workflow actions through natural language commands.

## Overview

This system provides:

- **Dashboard**: Overview of Estimates and Contracts with quick navigation
- **Estimates Workflow**: Six-stage structured process from artifacts to finalized quotes
- **Contracts Workflow**: Policy-guided agreement generation, review, and version management
- **Global Copilot**: Context-aware AI assistant that works across both workflows

## Features

### Dashboard
- Two overview cards showing counts and last updated timestamps
- Quick navigation to Estimates and Contracts workflows

### Estimates Workflow
A structured six-stage estimation process:

1. **Artifacts**: Create project and attach ≥2 artifacts (transcripts, documents, notes)
2. **Business Case**: LLM-generated business case from artifacts (scope, outcomes, constraints)
3. **Requirements**: LLM-generated requirements summary from artifacts
4. **Solution/Architecture**: Document approach, tech stack, and risks
5. **Effort Estimate**: LLM-generated WBS with tasks, roles, hours, and assumptions
6. **Quote**: Apply rates, add payment terms, export CSV, mark delivered

**Key Screens:**
- Projects list with stage filtering
- Project detail with stage stepper, current stage panel, and transition history timeline
- Stage transitions with validation gates and approval controls

### Contracts Workflow
Policy-guided contract management:

- **Policy Management**: CRUD for policy rules and example agreements (MSA, SOW, NDA)
- **Agreement Creation**: Generate LLM-powered agreements from policies and exemplars
- **Client Draft Review**: Upload/paste client drafts, get policy-based change proposals with before/after text
- **Estimate Validation**: Link SOWs to estimates and validate alignment
- **Version Management**: Track versions, notes, and change timeline

**Key Screens:**
- Policy management interface
- Agreements list with type, counterparty, and version info
- Agreement detail with version selector and timeline
- Review screen with side-by-side change proposals

### Global Copilot
Right-side AI assistant that:

- **Context-aware**: Knows which workflow and entity you're viewing
- **Cross-workflow**: Can read from Estimates and write to Contracts (e.g., "Create MSA and SOW from Project Apollo's estimate")
- **Action-oriented**: Executes ≥6 real actions including:
  - Adjust estimate hours and line items
  - Fetch project totals
  - Summarize agreement pushbacks
  - Add notes to agreements
  - Apply change proposals
  - Create agreements from estimates

## Tech Stack

### Frontend
- **Next.js** with React
- **CopilotKit** (`@copilotkit/react-core`, `@copilotkit/react-ui`)
- **TipTap** for rich text editing
- **AG-UI LangGraph** integration

### Backend
- **FastAPI** (Python 3.12)
- **LangChain** & **LangGraph** for AI orchestration
- **Pydantic** for data validation
- **OpenAI/Anthropic** via LangChain

### Persistence
- **Supabase** (PostgreSQL + storage) as the system-of-record

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Python 3.12+ (if running locally)
- Node.js 18+ (if running locally)
- API keys for OpenAI or Anthropic
- Supabase project credentials (URL, anon/service keys)

### Local Setup (≤10 minutes)

1. **Clone the repository**
   ```bash
   git clone https://github.com/TheValverde/Multi-Workflow-System
   cd Multi-Workflow-System
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys:
   # OPENAI_API_KEY=your-key-here
   # ANTHROPIC_API_KEY=your-key-here (optional)
   ```

3. **Start with Docker**
   ```bash
   docker-compose up -d
   ```

   Or run locally:
   ```bash
   # Backend
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload

   # Frontend
   cd frontend
   npm install
   npm run dev
   ```

4. **Seed the database**
   ```bash
   # Run seed script
   python scripts/seed.py
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Seeding Demo Data

The seed script creates:

- **Estimates**: Sample projects at various stages with artifacts
- **Contracts**: Example policies, agreements, and versions
- **RAW_TEXT**: Exemplar contracts loaded from `RAW_TEXT/` directory

Run seeding:
```bash
python scripts/seed.py
```

Or via Docker:
```bash
docker-compose exec backend python scripts/seed.py
```

## Project Structure

```
Multi-Workflow-System/
├── features/
│   ├── dashboard/          # Dashboard feature docs
│   ├── estimates_workflow/ # Estimates workflow docs
│   ├── contracts_workflow/ # Contracts workflow docs
│   └── copilot_global/     # Copilot feature docs
├── DELIVERABLES/
│   ├── AI_ARTIFACTS.md     # AI development documentation
│   ├── APPROACH.md         # Development approach
│   └── TESTING.md          # Testing documentation
├── RAW_TEXT/               # Example contracts (MSA, SOW, NDA)
├── backend/                # FastAPI backend
├── frontend/               # Next.js frontend
├── scripts/                # Utility scripts (seed.py, etc.)
├── PRD.md                  # Product requirements
├── RULES.md                # Original requirements
├── README.md               # This file
├── .env.example           # Environment template
└── docker-compose.yml      # Docker configuration
```

## API Endpoints

### Estimates
- `GET /api/estimates` - List all projects
- `GET /api/estimates/:id` - Get project detail
- `POST /api/estimates` - Create new project
- `PATCH /api/estimates/:id` - Update project
- `GET /api/estimates/:id/stage/:stage` - Get stage data
- `POST /api/estimates/:id/artifacts` - Upload artifacts
- `GET /api/estimates/:id/export` - Export quote as CSV

### Contracts
- `GET /api/contracts` - List all agreements
- `GET /api/contracts/:id` - Get agreement detail
- `POST /api/contracts` - Create new agreement
- `PATCH /api/contracts/:id` - Update agreement
- `GET /api/contracts/:id/versions` - Get version history
- `POST /api/contracts/:id/versions` - Create new version
- `POST /api/contracts/:id/review` - Review client draft
- `GET /api/contracts/:id/validate` - Validate against estimate
- `GET /api/policies` - List policy rules
- `POST /api/policies` - Create policy

### Copilot
- WebSocket connection for real-time agent communication
- Context automatically updated based on current page/entity

## Testing

See [TESTING.md](DELIVERABLES/TESTING.md) for detailed testing instructions.

Run tests:
```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## Documentation

- **[PRD.md](PRD.md)**: Product requirements document
- **[RULES.md](RULES.md)**: Original requirements and scoring criteria
- **[AI_ARTIFACTS.md](DELIVERABLES/AI_ARTIFACTS.md)**: AI-assisted development documentation
- **[APPROACH.md](DELIVERABLES/APPROACH.md)**: Development approach and tools used
- **[TESTING.md](DELIVERABLES/TESTING.md)**: Testing strategy and examples

## Copilot Examples

### Estimates Workflow
- "Increase Backend hours by 10%"
- "Add a QA line: 40h at $90/hr, rationale 'regression pass'"
- "What's the current total for Project Apollo?"

### Contracts Workflow
- "Summarize pushbacks on this agreement"
- "Add a note: 'Net 45 acceptable with 2% discount'"
- "Apply the payment-terms proposals and create a new version"

### Cross-Workflow
- "Create a new MSA and SOW for Project Apollo; use the scope and estimate from the Estimates workflow"

## Development

### Adding New Copilot Actions

1. Define the tool function in the backend agent
2. Register it in the LangGraph agent tools
3. Update the frontend to handle the action response
4. Test with natural language commands

### Adding New Workflow Stages

1. Update the state schema in the backend
2. Add stage validation logic
3. Create frontend stage component
4. Update stage stepper and navigation

## License

[Specify license if applicable]

## Contact

[Add contact information if needed]


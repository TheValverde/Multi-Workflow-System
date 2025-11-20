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
- **Next.js 16** with React 19
- **CopilotKit** (`@copilotkit/react-core`, `@copilotkit/react-ui`)
- **TipTap** for rich text editing
- **React Query** (`@tanstack/react-query`) for data fetching and caching
- **Supabase JS** for database and storage

### Backend
- **LangGraph Agent** (Python 3.12) running on port 8123
- **LangChain** & **LangGraph** for AI orchestration
- **uv** package manager (10-100x faster than pip)
- **OpenAI/Anthropic** via LangChain

### Persistence
- **Supabase** (PostgreSQL + storage) as the system-of-record

## Quick Start

### Prerequisites
- Docker and Docker Compose (recommended)
- Node.js 18+ and pnpm
- Python 3.12+ and uv (if running locally)
- API keys for OpenAI or Anthropic
- Supabase project credentials (URL, anon/service keys)

### Local Setup (≤10 minutes)

1. **Clone the repository**
   ```bash
   git clone https://github.com/TheValverde/Multi-Workflow-System
   cd Multi-Workflow-System/fs-agent
   ```

2. **Set up environment variables**
   ```bash
   # Copy example environment files
   cp .env.example .env.local
   cp agent/.env.example agent/.env
   
   # Edit .env.local and agent/.env and add your API keys:
   # OPENAI_API_KEY=your-key-here
   # ANTHROPIC_API_KEY=your-key-here (optional)
   # SUPABASE_URL=https://your-project.supabase.co
   # SUPABASE_ANON_KEY=your-anon-key
   # SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Install dependencies**
   ```bash
   # Install JavaScript dependencies
   pnpm install
   
   # Set up Python agent (creates venv and installs dependencies)
   cd agent
   uv venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   uv pip sync requirements.txt
   cd ..
   ```

4. **Start the development server**
   ```bash
   # Start both frontend and agent concurrently
   pnpm dev
   
   # Or start services individually:
   pnpm dev:ui      # Frontend only (port 3000)
   pnpm dev:agent   # Agent only (port 8123)
   ```

5. **Seed the database**
   ```bash
   # Seed policies and exemplars
   pnpm seed:policies
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - LangGraph Agent: http://localhost:8123
   - Dashboard: http://localhost:3000 (root route)

## Docker Setup (Optional, Untested)

> **Note**: Docker setup is provided but has not been fully tested. Local development with `pnpm dev` is the recommended approach.

For a containerized development environment:

```bash
# Build and start all services
cd fs-agent
docker-compose up --build

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Services:
- **Frontend**: http://localhost:3000
- **Agent**: http://localhost:8123

**Note**: You'll need to set environment variables in a `.env` file at the `fs-agent/` root for Docker to pick them up, or pass them via `docker-compose` environment section.

## Seeding Demo Data

The seed script creates:

- **Policies**: Contract policy rules from `RAW_TEXT/policies.json`
- **Exemplars**: Example contracts (MSA, SOW) from `RAW_TEXT/exemplars/` directory

Run seeding:
```bash
pnpm seed:policies
```

## Project Structure

```
Multi-Workflow-System/
├── fs-agent/                 # Main application directory
│   ├── agent/                # LangGraph Python agent
│   │   ├── agent.py          # Main agent logic
│   │   ├── langgraph.json    # LangGraph configuration
│   │   ├── requirements.txt  # Python dependencies
│   │   ├── pyproject.toml    # uv project config
│   │   ├── Dockerfile        # Agent container
│   │   └── .env              # Agent environment variables
│   ├── src/                  # Next.js frontend
│   │   ├── app/              # Next.js app router
│   │   │   ├── api/          # API routes
│   │   │   ├── estimates/    # Estimates pages
│   │   │   ├── contracts/    # Contracts pages
│   │   │   └── policies/     # Policies pages
│   │   ├── components/        # React components
│   │   ├── lib/              # Utility functions
│   │   └── hooks/            # React hooks
│   ├── scripts/              # Utility scripts
│   │   └── seed-policies.mjs # Seed policies/exemplars
│   ├── migrations/           # Database migrations
│   ├── docker-compose.yml    # Docker services
│   ├── Dockerfile.frontend   # Frontend container
│   ├── .env.local            # Frontend environment
│   └── README.md             # Detailed setup guide
├── AGILE/                    # Agile project management
│   ├── sprints/              # Sprint definitions
│   └── stories/              # User stories
├── DELIVERABLES/             # Project deliverables
│   ├── AI_ARTIFACTS.md       # AI development documentation
│   ├── APPROACH.md           # Development approach
│   └── TESTING.md            # Testing documentation
├── features/                 # Feature documentation
│   ├── dashboard/            # Dashboard feature docs
│   ├── estimates_workflow/   # Estimates workflow docs
│   ├── contracts_workflow/    # Contracts workflow docs
│   └── copilot_global/      # Copilot feature docs
├── RAW_TEXT/                 # Example contracts (MSA, SOW, NDA)
├── PRD.md                    # Product requirements
├── RULES.md                  # Original requirements
└── README.md                 # This file
```

## API Endpoints

### Estimates
- `GET /api/estimates` - List all projects
- `GET /api/estimates/:id` - Get project detail
- `PATCH /api/estimates/:id` - Update project (approve/advance stages)
- `POST /api/estimates/:id/artifacts` - Upload artifacts
- `GET /api/estimates/:id/business-case` - Get Business Case
- `PATCH /api/estimates/:id/business-case` - Update Business Case
- `POST /api/estimates/:id/business-case/generate` - Generate Business Case
- `GET /api/estimates/:id/requirements` - Get Requirements
- `PATCH /api/estimates/:id/requirements` - Update Requirements
- `POST /api/estimates/:id/requirements/generate` - Generate Requirements
- `GET /api/estimates/:id/effort` - Get Effort Estimate (WBS)
- `PATCH /api/estimates/:id/effort` - Update Effort Estimate
- `POST /api/estimates/:id/effort/generate` - Generate WBS
- `GET /api/estimates/:id/quote` - Get Quote
- `PATCH /api/estimates/:id/quote` - Update Quote
- `GET /api/estimates/:id/export` - Export quote as CSV
- `GET /api/estimates/:id/stage/estimate` - Get stage data for Contracts workflow

### Contracts
- `GET /api/contracts` - List all agreements
- `POST /api/contracts` - Create new agreement
- `GET /api/contracts/:id` - Get agreement detail
- `PATCH /api/contracts/:id` - Update agreement
- `PATCH /api/contracts/:id/autosave` - Auto-save agreement content
- `POST /api/contracts/:id/versions` - Create new version
- `POST /api/contracts/:id/review` - Review client draft
- `GET /api/contracts/:id/validate` - Validate against estimate
- `POST /api/contracts/:id/draft` - Upload client draft
- `POST /api/contracts/:id/notes` - Add note to agreement

### Policies
- `GET /api/policies` - List policy rules
- `POST /api/policies` - Create policy
- `GET /api/policies/:id` - Get policy detail
- `PATCH /api/policies/:id` - Update policy
- `DELETE /api/policies/:id` - Delete policy
- `GET /api/policies/exemplars` - List contract exemplars
- `POST /api/policies/exemplars` - Upload exemplar
- `GET /api/policies/exemplars/:id` - Get exemplar
- `DELETE /api/policies/exemplars/:id` - Delete exemplar
- `GET /api/policies/summary` - Get policies summary

### Dashboard
- `GET /api/dashboard/metrics` - Get dashboard metrics (counts, last updated)

### Copilot
- `POST /api/copilotkit` - CopilotKit WebSocket endpoint
- Context automatically updated based on current page/entity

## Testing

See [TESTING.md](DELIVERABLES/TESTING.md) for detailed testing instructions.

Run tests:
```bash
# Frontend tests
cd fs-agent
pnpm test

# Backend tests (Python agent)
cd fs-agent/agent
uv run pytest
```

## Documentation

- **[PRD.md](PRD.md)**: Product requirements document
- **[RULES.md](RULES.md)**: Original requirements and scoring criteria
- **[AI_ARTIFACTS.md](DELIVERABLES/AI_ARTIFACTS.md)**: AI-assisted development documentation
- **[APPROACH.md](DELIVERABLES/APPROACH.md)**: Development approach and tools used
- **[TESTING.md](DELIVERABLES/TESTING.md)**: Testing strategy and examples
- **[fs-agent/README.md](fs-agent/README.md)**: Detailed technical setup guide

## Copilot Examples

### Estimates Workflow
- "Increase Backend hours by 10%"
- "Add a QA line: 40h at $90/hr, rationale 'regression pass'"
- "What's the current total for Project Apollo?"
- "Generate Business Case from artifacts"
- "Update payment terms to Net 45"
- "Advance stage" (gate-aware)

### Contracts Workflow
- "Summarize pushbacks on this agreement"
- "Add a note: 'Net 45 acceptable with 2% discount'"
- "Apply the payment-terms proposals and create a new version"
- "Create agreements from this estimate"

### Cross-Workflow
- "Create a new MSA and SOW for Project Apollo; use the scope and estimate from the Estimates workflow"

## Development

### Adding New Copilot Actions

1. Define the tool function in `fs-agent/agent/agent.py`
2. Register it in the LangGraph agent tools
3. Optionally add frontend action handler with `useCopilotAction` hook
4. Test with natural language commands

### Adding New Workflow Stages

1. Update `STAGES` in `fs-agent/src/lib/stages.ts`
2. Add stage gate logic in `fs-agent/src/lib/stage-gates.ts`
3. Create frontend stage panel component
4. Update stage stepper and navigation
5. Add API routes for stage data

### Python Dependency Management

This project uses **uv** instead of pip for faster dependency management:

```bash
cd fs-agent/agent

# Activate virtual environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Sync dependencies
uv pip sync requirements.txt

# Add new package
uv pip install <package-name>
uv pip freeze > requirements.txt

# Run commands with uv
uv run python agent.py
uv run langgraph dev --host 0.0.0.0 --port 8123
```

**Why uv?**
-  10-100x faster than pip
-  Better dependency resolution
-  Modern Python tooling
-  Compatible with pip and requirements.txt

# Development Notes — fs-agent

## Port Allocation & UFW Configuration

### Chosen Ports

Based on UFW audit and Docker container inspection (2025-11-19), the following ports were selected to avoid conflicts:

| Service | Port | Reason |
|---------|------|--------|
| Next.js Frontend | 3000 | Standard Next.js port, already configured in UFW |
| LangGraph Agent | 8123 | Non-conflicting port, used by langgraph-cli |
| Supabase (if local) | 5440 | Avoids conflicts with PostgreSQL on 5432-5439 |

### UFW Firewall Rules

Port 3000 is already open in UFW for Next.js applications:
```bash
sudo ufw allow 3000/tcp comment "Next.js React App"
```

Port 8123 is **not currently in use** and can be added if needed:
```bash
sudo ufw allow 8123/tcp comment "LangGraph Agent - fs-agent"
```

### Conflicting Ports to Avoid

The following ports are **already in use** on this system:
- **8000**: Generic Python/HTTP services
- **8001**: Haus Lumière Backend API
- **8002**: Ecommerce Discovery API
- **8003**: WebSpeedAudit API
- **8004**: NutriChat Backend API
- **8010-8011, 8017, 8019-8022, 8025-8026**: Various MCP and AG-UI servers
- **8080-8096**: qBittorrent, Sonarr, Radarr, Jellyfin, etc.
- **5432-5439**: PostgreSQL databases for various projects

## Docker Compose Architecture

### Service Design

The `docker-compose.yml` is designed with the following principles:

1. **Two-service architecture**:
   - `frontend`: Next.js application built from source
   - `agent`: LangGraph agent service running Python with uv

2. **Networking**:
   - Custom bridge network `fs-agent-network`
   - Services communicate via service names (e.g., `agent:8123`)
   - Exposed ports: 3000 (frontend), 8123 (agent)

3. **Volumes**:
   - Source code mounted for hot-reload during development
   - Named volume `agent-venv` for Python virtual environment persistence
   - node_modules and .next excluded from mounts for performance

4. **Health Checks**:
   - Agent service includes health check on `/health` endpoint
   - 30s interval, 10s timeout, 3 retries, 40s start period

### Build Strategy

**Frontend Dockerfile** (`Dockerfile.frontend`):
- Multi-stage build for production optimization
- Base → deps → builder → runner
- Uses pnpm for dependency management
- Runs as non-root user (nextjs:nodejs)

**Agent Dockerfile** (`agent/Dockerfile`):
- Python 3.12-slim base image
- uv installed for dependency management
- Virtual environment created and synced with requirements.txt
- Runs langgraph dev server on 0.0.0.0:8123

## uv Virtual Environment Setup

### Implementation

Instead of vanilla pip, the project uses **uv** for Python dependency management:

1. **pyproject.toml**: Created for uv-native dependency specification
2. **Virtual environment**: Created with `uv venv` in `agent/.venv`
3. **Dependency sync**: Use `uv pip sync requirements.txt` instead of `pip install -r`

### Benefits

- **Faster installs**: uv is 10-100x faster than pip
- **Reproducible builds**: Better lock file management
- **Modern Python**: Follows PEP standards
- **Compatible**: Works with existing requirements.txt

### Commands

```bash
# Create virtual environment
cd agent && uv venv

# Sync dependencies
uv pip sync requirements.txt

# Add new dependency
uv pip install <package>
uv pip freeze > requirements.txt

# Run with uv
uv run python agent.py
uv run langgraph dev --host 0.0.0.0 --port 8123
```

## CopilotKit Shared State Integration

### Architecture Overview

The integration uses the **AG-UI** pattern from CopilotKit with LangGraph:

1. **Frontend** (`src/app/page.tsx`):
   - `useCoAgent` hook connects to `sample_agent`
   - State type matches Python agent state (`proverbs: string[]`)
   - `useCopilotAction` provides frontend actions (addProverb, setThemeColor)

2. **Agent** (`agent/agent.py`):
   - `AgentState` extends `MessagesState` with custom fields (proverbs, tools)
   - Tools are passed via `state.get("tools", [])` from frontend
   - System message includes state context

3. **API Route** (`src/app/api/copilotkit/route.ts`):
   - `LangGraphAgent` connects to `http://localhost:8123`
   - `CopilotRuntime` manages agent lifecycle
   - `ExperimentalEmptyAdapter` for single-agent setup

### Key Patterns

- **Bi-directional state**: Frontend can update agent state, agent can read and modify
- **Tool passthrough**: Frontend tools (useCopilotAction) are passed to agent
- **Generative UI**: Agent tool calls render as React components
- **Type safety**: TypeScript types match Python state structure

## STORY-004 — Business Case & Requirements Agent Flow

### Supabase schema

- Added `estimate_business_case` and `estimate_requirements` tables with `content`, approval flags, approver metadata, and `updated_at`.
- Detail fetch ensures both rows exist for every estimate (auto-upsert) so editors always have a backing record.
- Every generation/update/approval logs to `estimate_timeline` for audit parity with the UI.

### API surface

- `/api/estimates/[id]/business-case` (`GET`/`PATCH`) → save drafts, approve, and refresh shared state.
- `/api/estimates/[id]/business-case/generate` → summarize artifacts into TipTap-ready HTML, reset approval flag, timeline entry "Business Case generated by Copilot".
- `/api/estimates/[id]/requirements` + `/generate` mirror the Business Case endpoints but drive validation instead of approval.
- `/api/estimates/[id]` now blocks `advance` unless:
  - ≥2 artifacts exist (Artifacts stage)
  - Business Case is approved (Business Case stage)
  - Requirements are validated (Requirements stage)

### Frontend UX

- `RichTextEditor` (TipTap) powers both editors with bold/italic/list tooling and dirty-state detection.
- Panels expose `Generate with Copilot`, `Save Draft`, and `Approve/Validate` with clear status pills and relative timestamps.
- Shared state now carries `timelineVersion` so silent refreshes occur when Copilot logs new events out-of-band.
- `useCopilotAction` registers `generateBusinessCase` + `generateRequirements` so agents or UI can trigger the same flows.

### LangGraph tooling

- Added backend tools (`summarize_business_case`, `summarize_requirements`) that fetch artifacts via Supabase REST (new `requests` dependency).
- `AgentState` tracks `timeline_version` to help the frontend detect agent-driven updates.
- System prompt inherits new tools automatically via `backend_tools`.

### Dependencies / install steps

- Frontend: `@tiptap/react`, `@tiptap/starter-kit`
- Agent: `requests`
- After pulling, run `pnpm install` (root) and `cd agent && uv pip sync` (or `uv pip install -e .`) to refresh environments.

## STORY-005 — Effort Estimate WBS & Stage APIs

### Data model

- Added `estimate_wbs_rows` + `estimate_wbs_versions` via Supabase MCP; `fetchEstimateDetail` now returns `effortEstimate` with rows, version history, and approved snapshot.
- Advancing out of the Effort Estimate stage requires an approved version (enforced in both UI and `/api/estimates/[id]`).

### API surface

- `POST /api/estimates/[id]/effort/generate` → produces ≥5-row WBS drafts, persists rows, logs timeline entry.
- `GET/PATCH /api/estimates/[id]/effort` → inline editing, manual approvals (creates version entries + timeline log).
- `GET /api/estimates/[id]/stage/estimate` → normalized payload (hours + role summary) for contracts validation. Covered by Vitest.

### Frontend UX

- New `EffortEstimatePanel` with editable table, totals, role summary, and version history.
- Copilot actions:
  - `addWbsLineItem` to append and persist tasks.
  - `adjustWbsHours` to update estimates in-place.
- Shared-state timeline refresh now reflects WBS updates/approvals instantly.

### LangGraph tooling

- Added `generate_wbs` backend tool; reads Supabase artifacts/requirements through REST, composes rows, and persistently writes to `estimate_wbs_rows`.
- Reuses the same heuristics as the Next.js generator so AI + UI stay in sync.

### Testing

- Introduced `vitest` config + `pnpm test`.
- `src/lib/__tests__/stageEstimate.test.ts` verifies stage-estimate payload shape + WBS generator invariants (≥5 tasks, artifact references).

## STORY-006 — Quote Stage Export & Delivery Flag

### Data model

- Added `estimate_quote`, `estimate_quote_rates`, and `estimate_quote_overrides` tables. Every estimate now has a quote record, per-role rates, and optional per-task overrides.
- Quote updates bump `estimates.updated_at` so dashboard metrics keep “last updated” in sync.

### APIs

- `GET/PATCH /api/estimates/[id]/quote` handles rate edits, payment terms, overrides, and delivered toggles (with admin override support). Timeline entries record delivery/reopen events.
- `GET /api/estimates/[id]/export` streams the CSV artifact consumed by Contracts / clipboard copy.
- `GET /api/estimates/[id]/stage/estimate` now includes costing totals, payment terms, delivery timeline, and per-line rate/role info.

### Frontend

- New Quote panel renders:
  - Role rate table with add/remove, per-task override grid, hours & cost summary.
  - Payment terms / delivery timeline inputs.
  - CSV export + clipboard copy, Save Quote, and Mark Delivered controls (locked once delivered).
- Quote totals stay in sync locally via `calculateQuoteTotals`, and Copilot can call `getProjectTotal` for voice commands.

### Agent tooling

- Added `get_project_total` backend tool so LangGraph actions/automations can validate totals, mirroring the UI calculations.
- Copilot action wired in `ProjectDetailView` calls the stage estimate API to confirm totals for the current project.

### Export/test updates

- `buildQuoteCsv` generates header + WBS line items + totals; covered alongside `calculateQuoteTotals` in Vitest.
- CSV endpoint powers both download + clipboard flows to satisfy the “export + fallback” requirement.

## Supabase Integration (Placeholder)

### Environment Variables

The following Supabase variables are defined in `.env.example`:

- `SUPABASE_URL`: Project API URL
- `SUPABASE_ANON_KEY`: Public anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Admin key (never expose to frontend!)

### Future Implementation

When implementing Supabase:

1. **Database Setup**:
   - Create tables for estimates, contracts, artifacts
   - Enable Row Level Security (RLS)
   - Create policies for user access

2. **Agent Integration**:
   - Add `supabase-py` to requirements.txt
   - Create Supabase client in agent.py
   - Use service role key for admin operations

3. **Frontend Integration**:
   - Add `@supabase/supabase-js` to package.json
   - Create client with anon key
   - Use with RLS for user-scoped data

4. **Seeding**:
   - Create `supabase/seed.sql` with sample data
   - Include in README setup instructions

## Deployment Considerations

### Development

- Use `pnpm dev` for local development (runs both services concurrently)
- Alternatively, use `docker compose up` for containerized development
- Environment variables loaded from `agent/.env` and root `.env.local`

### Production

1. **Frontend**: Deploy to Vercel, Netlify, or self-hosted
2. **Agent**: Deploy to LangGraph Cloud or self-hosted with Docker
3. **Environment**: Use secrets management (not .env files)
4. **Database**: Use managed Supabase or self-hosted PostgreSQL

## Deviations from Standard Setup

### CopilotKit MCP Upgrade

The current implementation uses:
- `@copilotkit/react-core`: ^1.10.6
- `@copilotkit/react-ui`: ^1.10.6
- `@copilotkit/runtime`: ^1.10.6
- `@ag-ui/langgraph`: ^0.0.18

This is the **latest stable version** supporting shared state via the AG-UI pattern.

### LangGraph CLI Version

Using `langgraph-cli[inmem]>=0.3.3` for in-memory state management during development. For production, consider:
- PostgreSQL checkpointer (`langgraph-checkpoint-postgres`)
- Redis checkpointer (for faster access)

## Troubleshooting

### Port Conflicts

If ports 3000 or 8123 are in use:

```bash
# Check what's using the port
sudo lsof -i :3000
sudo lsof -i :8123

# Kill the process (replace <PID>)
kill -9 <PID>

# Or change ports in docker-compose.yml and package.json
```

### Docker Build Failures

If frontend build fails due to missing pnpm-lock.yaml:

```bash
# Generate lock file
pnpm install

# Rebuild containers
docker compose build --no-cache
```

### Agent Connection Issues

If frontend can't connect to agent:

1. Check agent is running: `curl http://localhost:8123/health`
2. Check Docker network: `docker network inspect fs-agent-network`
3. Verify `LANGGRAPH_DEPLOYMENT_URL` in environment

## Future Enhancements

- [ ] Add PostgreSQL checkpointer for agent state persistence
- [ ] Implement Supabase integration for data storage
- [ ] Add Redis for caching and session management
- [ ] Create Kubernetes manifests for cloud deployment
- [ ] Add Traefik or Nginx reverse proxy for production
- [ ] Implement authentication with Supabase Auth
- [ ] Add monitoring with Prometheus + Grafana
- [ ] Setup CI/CD with GitHub Actions

## References

- [CopilotKit Shared State Docs](https://docs.copilotkit.ai/coagents/shared-state)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [uv Documentation](https://github.com/astral-sh/uv)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment)


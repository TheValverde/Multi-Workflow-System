# fs-agent — CopilotKit + LangGraph Starter with Shared State

This project is a production-ready starter template for building AI-powered applications using [CopilotKit](https://copilotkit.ai) and [LangGraph](https://www.langchain.com/langgraph). It features **shared state architecture** for bidirectional communication between your UI and AI agents, with full Docker support and modern Python tooling.

## ✨ Features

- 🤖 **LangGraph Agent**: Python-based AI agent with tool calling and state management
- 🎨 **CopilotKit UI**: Pre-built React components with shared state integration
- 🔄 **Bidirectional State**: UI and agent stay in sync automatically
- 🐳 **Docker Support**: Full containerization with docker-compose
- ⚡ **uv Package Manager**: 10-100x faster than pip for Python dependencies
- 🗄️ **Supabase Ready**: Environment variables configured for easy integration
- 🔥 **Hot Reload**: Development mode with live code updates

## 📋 Prerequisites

- **Node.js** 18+ (for Next.js frontend)
- **Python** 3.11+ (for LangGraph agent)
- **pnpm** (recommended package manager)
- **uv** (Python package manager) — [Install here](https://github.com/astral-sh/uv)
- **Docker & Docker Compose** (optional, for containerized development)
- **OpenAI API Key** (required for LLM functionality)

## 🚀 Quick Start (< 10 minutes)

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url> fs-agent
cd fs-agent

# Install JavaScript dependencies
pnpm install

# Create Python virtual environment
cd agent
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip sync requirements.txt
cd ..
```

### 2. Configure Environment

```bash
# Copy example environment files
cp .env.example .env.local
cp agent/.env.example agent/.env

# Edit agent/.env and add your OpenAI API key
OPENAI_API_KEY=sk-...
```

**Required environment variables:**
- `OPENAI_API_KEY`: Your OpenAI API key (get one at [platform.openai.com](https://platform.openai.com))

**Optional environment variables:**
- `ANTHROPIC_API_KEY`: For Claude models
- `LANGSMITH_API_KEY`: For LangSmith tracing
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: For database integration

See [`.env.example`](.env.example) for the complete list.

### 3. Run Development Server

```bash
# Start both frontend and agent concurrently
pnpm dev

# Or start services individually:
pnpm dev:ui      # Frontend only (port 3000)
pnpm dev:agent   # Agent only (port 8123)
```

Open [http://localhost:3000](http://localhost:3000) to see your app! 🎉

## 🐳 Docker Setup

For a fully containerized development environment:

```bash
# Build and start all services
docker compose up --build

# Run in detached mode
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

Services:
- **Frontend**: http://localhost:3000
- **Agent**: http://localhost:8123

## 📦 Port Configuration

This project uses the following ports (configured to avoid conflicts with existing services):

| Service | Port | Firewall Status |
|---------|------|-----------------|
| Next.js Frontend | 3000 | ✅ Already open |
| LangGraph Agent | 8123 | ⚠️ Add if needed |
| Supabase (local) | 5440 | ℹ️ If self-hosting |

### UFW Firewall Configuration

```bash
# Port 3000 is already configured for Next.js
# Add port 8123 for the agent if needed:
sudo ufw allow 8123/tcp comment "LangGraph Agent - fs-agent"
sudo ufw status
```

See [`DEV_NOTES.md`](DEV_NOTES.md) for detailed port allocation decisions.

## 🗄️ Supabase Setup (Optional)

To integrate with Supabase for persistent data storage:

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and API keys from Settings > API

### 2. Configure Environment

Update your `.env.local` and `agent/.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Create Database Schema

```sql
-- Example schema for estimates workflow
CREATE TABLE estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

-- Create policy (example: anyone can read)
CREATE POLICY "Enable read access for all users" ON estimates
  FOR SELECT USING (true);
```

### 4. Seed Data (Optional)

```bash
# Create a seed file at supabase/seed.sql
# Then run from Supabase SQL Editor or locally:
psql -h db.your-project.supabase.co -U postgres -d postgres -f supabase/seed.sql
```

## 🛠️ Development Guide

### Project Structure

```
fs-agent/
├── agent/                    # Python LangGraph agent
│   ├── agent.py             # Main agent logic
│   ├── langgraph.json       # LangGraph configuration
│   ├── requirements.txt     # Python dependencies
│   ├── pyproject.toml       # uv project config
│   ├── Dockerfile           # Agent container
│   └── .env                 # Agent environment variables
├── src/
│   ├── app/
│   │   ├── page.tsx         # Main application page
│   │   ├── layout.tsx       # Root layout with CopilotKit
│   │   └── api/
│   │       └── copilotkit/
│   │           └── route.ts # CopilotKit API endpoint
│   └── ...
├── docker-compose.yml       # Docker services configuration
├── Dockerfile.frontend      # Frontend container
├── .env.example             # Example environment variables
├── DEV_NOTES.md            # Development notes and decisions
└── README.md               # This file
```

### Available Scripts

```bash
# Development
pnpm dev              # Start both UI and agent
pnpm dev:debug        # Start with debug logging
pnpm dev:ui           # Start Next.js only
pnpm dev:agent        # Start LangGraph agent only

# Build
pnpm build            # Build Next.js for production
pnpm start            # Start production server

# Maintenance
pnpm lint             # Run ESLint
pnpm install:agent    # Reinstall Python dependencies
```

### Python Dependency Management with uv

Instead of pip, this project uses **uv** for faster, more reliable Python package management:

```bash
cd agent

# Activate virtual environment
source .venv/bin/activate

# Install/sync dependencies
uv pip sync requirements.txt

# Add new package
uv pip install <package-name>
uv pip freeze > requirements.txt

# Run commands with uv
uv run python agent.py
uv run langgraph dev --host 0.0.0.0 --port 8123
```

**Why uv?**
- ⚡ 10-100x faster than pip
- 🔒 Better dependency resolution
- 🎯 Modern Python tooling
- ✅ Compatible with pip and requirements.txt

## 🔧 CopilotKit Shared State

This project uses **CopilotKit Shared State** for bidirectional communication between the UI and agent.

### How it Works

1. **Frontend** (`src/app/page.tsx`):
```typescript
const { state, setState } = useCoAgent<AgentState>({
  name: "sample_agent",
  initialState: { proverbs: [] },
});
```

2. **Agent** (`agent/agent.py`):
```python
class AgentState(MessagesState):
    proverbs: List[str] = []
    tools: List[Any]
```

3. **API Route** (`src/app/api/copilotkit/route.ts`):
```typescript
const runtime = new CopilotRuntime({
  agents: {
    "sample_agent": new LangGraphAgent({
      deploymentUrl: "http://localhost:8123",
      graphId: "sample_agent",
    }),
  }
});
```

### Key Features

- ✅ State automatically syncs between UI and agent
- ✅ Frontend actions (via `useCopilotAction`) available to agent
- ✅ Agent tool calls render as React components (Generative UI)
- ✅ Type-safe with TypeScript and Python typing

## 📚 Additional Documentation

- [**DEV_NOTES.md**](DEV_NOTES.md) — Port allocation, Docker decisions, and architecture notes
- [**CopilotKit Docs**](https://docs.copilotkit.ai) — Official CopilotKit documentation
- [**LangGraph Docs**](https://langchain-ai.github.io/langgraph/) — LangGraph framework guide
- [**uv Docs**](https://github.com/astral-sh/uv) — Python package manager

## 🐛 Troubleshooting

### Agent Connection Issues

**Error**: "I'm having trouble connecting to my tools"

**Solutions**:
1. Check the agent is running: `curl http://localhost:8123/health`
2. Verify `OPENAI_API_KEY` is set in `agent/.env`
3. Ensure both services started successfully (`pnpm dev` output)
4. Check `LANGGRAPH_DEPLOYMENT_URL` in environment

### Python Import Errors

**Error**: `ModuleNotFoundError: No module named 'langchain'`

**Solution**:
```bash
cd agent
uv pip sync requirements.txt
# Or reinstall from root:
pnpm run install:agent
```

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find what's using the port
sudo lsof -i :3000

# Kill the process (replace <PID>)
kill -9 <PID>

# Or change the port in package.json dev:ui script
```

### Docker Build Failures

**Error**: Missing pnpm-lock.yaml or dependency issues

**Solution**:
```bash
# Regenerate lock file
pnpm install

# Clean rebuild
docker compose down -v
docker compose build --no-cache
docker compose up
```

## 🚢 Deployment

### Frontend (Vercel - Recommended)

```bash
# Build for production
pnpm build

# Deploy to Vercel
vercel deploy --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_CPK_PUBLIC_API_KEY`
- `LANGGRAPH_DEPLOYMENT_URL` (your deployed agent URL)

### Agent (LangGraph Cloud)

```bash
# Deploy to LangGraph Cloud
langgraph deploy

# Or self-host with Docker
docker build -t fs-agent-langgraph ./agent
docker run -p 8123:8123 --env-file agent/.env fs-agent-langgraph
```

### Self-Hosted (Docker Compose)

```bash
# Use production docker-compose override
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 🔒 Security Notes

- ⚠️ **Never commit `.env` files** with real API keys
- ⚠️ **Service role keys** should only be used server-side
- ⚠️ Use **environment secrets** in production (not .env files)
- ✅ Enable **Row Level Security (RLS)** on Supabase tables
- ✅ Implement **authentication** for production deployments

## 🤝 Contributing

Contributions are welcome! This starter is designed to be easily extensible.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [CopilotKit](https://copilotkit.ai) — Agentic UI framework
- [LangGraph](https://www.langchain.com/langgraph) — Agent orchestration
- [Next.js](https://nextjs.org) — React framework
- [Supabase](https://supabase.com) — Backend as a Service
- [uv](https://github.com/astral-sh/uv) — Fast Python package manager

## Story 7 — Policy Management & Exemplars

- Supabase schema now includes `contract_policies`, `contract_exemplars`, and `contract_policy_exemplars`, plus a **public** `policy-exemplars` storage bucket for uploaded reference agreements.
- `/policies` introduces CRUD modals, exemplar uploads, summary stats, and Copilot actions (`createPolicyRule`, `listPolicies`) so the contracts workflow has a living knowledge base.
- APIs: `GET/POST /api/policies`, `GET/PATCH/DELETE /api/policies/:id`, `GET/POST /api/policies/exemplars`, and `GET /api/policies/summary`.
- LangGraph tool `load_exemplar_contracts(type)` lets the agent pull MSAs/SOWs/NDAs on demand.
- Seeding workflow:
  1. Create `RAW_TEXT/policies.json` with `{ title, category, summary, body, tags }` entries.
  2. Drop exemplar files into `RAW_TEXT/exemplars/<TYPE>/your-file.md`.
  3. Ensure `policy-exemplars` bucket exists (public) and `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are set locally.
  4. Run `pnpm seed:policies` to push both policies and exemplars into Supabase.

---

**Built with ❤️ for the future of agentic applications**

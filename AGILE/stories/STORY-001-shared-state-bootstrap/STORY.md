# STORY-001 — Shared State Bootstrap & Ops Readiness

## Summary
Convert the existing `fs-agent` Next.js project to the CopilotKit Shared State architecture, establish uv-based virtual environment tooling, audit Docker/port usage, and document setup so teammates can run the stack within 10 minutes.

## Business Value
Provides the stable foundation required for all subsequent workflows and satisfies PRD non-functional requirements (dockerization, uv, setup guidance, `.env.example`).

## Requirements
- Create uv virtual environment (`uv venv && uv pip sync`) and document usage instead of vanilla pip.
- Audit `ufw` and running Docker containers to pick non-conflicting ports; update README with port matrix and firewall commands.
- Ensure docker-compose spins up Next.js + LangGraph agent containers; images built from repo codebase.
- Provide `.env.example` covering OpenAI/Anthropic keys, Supabase URL/keys, and internal config used by LangGraph agents.
- Baseline CopilotKit integration updated to Shared State version per [CopilotKit LangGraph Shared State](https://docs.copilotkit.ai/langgraph/shared-state) guidance with placeholder agent verifying state sync inside AGUI.
- Document CopilotKitMCP upgrade steps (packages, config, schema) so later epics inherit the new shared state primitives.

## Acceptance Criteria
- Fresh clone can run `uv venv`, `uv pip install -r requirements.txt` (or sync file), and `pnpm install` without errors, then connect to Supabase using documented env vars.
- `docker compose up` starts services on documented ports with no conflicts; firewall configured accordingly.
- README includes setup (uv, pnpm, docker), Supabase provisioning steps, seeding command, and run instructions ≤10 minutes.
- Copilot sidebar renders with mock message proving shared state handshake using the Shared State schema derived from the docs.

## Implementation Notes
- Reference `CopilotKitMCP` upgrade steps + hooks from the shared state docs and capture deviations or overrides in `AI_ARTIFACTS.md`.
- Capture port/ufw decisions and docker-compose mappings in `DEV_NOTES.md` for future audits.

## Dependencies
- None (foundational).

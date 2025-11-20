"""
This is the main entry point for the agent.
It defines the workflow graph, state, tools, nodes and edges.
"""

import os
import re
from typing import Any, List, Optional
from typing_extensions import Literal
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, BaseMessage
from langchain_core.runnables import RunnableConfig
from langchain.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.types import Command
from langgraph.graph import MessagesState
from langgraph.prebuilt import ToolNode
import requests

class AgentState(MessagesState):
    """
    Global Copilot State - extends CopilotKitState with workflow and entity context.
    
    This state synchronizes across the Estimates and Contracts workflows, allowing
    the agent to be context-aware of which workflow and entity the user is viewing.
    """
    proverbs: List[str] = []
    tools: List[Any]
    # Legacy project fields (for backward compatibility)
    selected_project_id: Optional[str] = None
    selected_project_name: Optional[str] = None
    selected_project_stage: Optional[str] = None
    timeline_version: Optional[str] = None
    # Global copilot workflow context
    workflow: Optional[str] = None  # "estimates" | "contracts"
    entity_id: Optional[str] = None  # project_id or agreement_id
    entity_type: Optional[str] = None  # "project" | "agreement"
    entity_data: Optional[dict] = None  # Snapshot of current entity

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
DEFAULT_ROLE_RATE = 150


def fetch_artifacts(estimate_id: str):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return []
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/estimate_artifacts",
            params={
                "estimate_id": f"eq.{estimate_id}",
                "select": "filename,created_at,size_bytes",
                "order": "created_at.desc",
                "limit": "8",
            },
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
              },
            timeout=10,
        )
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        return [
            {
                "filename": "Unable to load artifacts",
                "created_at": "",
                "size_bytes": 0,
                "error": str(exc),
            }
        ]


def fetch_requirements_content(estimate_id: str) -> str:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return ""
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/estimate_requirements",
            params={
                "estimate_id": f"eq.{estimate_id}",
                "select": "content",
            },
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        if not data:
            return ""
        return data[0].get("content") or ""
    except Exception:
        return ""


def fetch_wbs_rows(estimate_id: str):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return []
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/estimate_wbs_rows",
            params={
                "estimate_id": f"eq.{estimate_id}",
                "select": "id,task_code,description,role,hours,assumptions,sort_order",
                "order": "sort_order.asc",
            },
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            timeout=10,
        )
        response.raise_for_status()
        return response.json()
    except Exception:
        return []


def fetch_quote_record(estimate_id: str):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/estimate_quote",
            params={
                "estimate_id": f"eq.{estimate_id}",
                "select": "currency,payment_terms,delivery_timeline,delivered",
                "limit": 1,
            },
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        return data[0] if data else None
    except Exception:
        return None


def fetch_quote_rates(estimate_id: str):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return []
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/estimate_quote_rates",
            params={
                "estimate_id": f"eq.{estimate_id}",
                "select": "role,rate",
            },
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            timeout=10,
        )
        response.raise_for_status()
        return response.json()
    except Exception:
        return []


def fetch_quote_overrides(estimate_id: str):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return []
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/estimate_quote_overrides",
            params={
                "estimate_id": f"eq.{estimate_id}",
                "select": "wbs_row_id,rate",
            },
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            timeout=10,
        )
        response.raise_for_status()
        return response.json()
    except Exception:
        return []


def fetch_exemplar_contracts(exemplar_type: str):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return []
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/contract_exemplars",
            params={
                "select": "id,title,type,summary,storage_path,tags,uploaded_by,created_at",
                "type": f"eq.{exemplar_type}",
                "order": "created_at.desc",
                "limit": 10,
            },
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        for exemplar in data:
            exemplar["public_url"] = (
                f"{SUPABASE_URL}/storage/v1/object/public/"
                f"policy-exemplars/{exemplar['storage_path']}"
            )
        return data
    except Exception as exc:
        return [
            {
                "title": "Unable to load exemplars",
                "type": exemplar_type,
                "summary": str(exc),
            }
        ]


def summarize_from_artifacts(artifacts, intro: str, outro: str):
    if artifacts and "error" in artifacts[0]:
        return f"{intro}\n\n- {artifacts[0]['error']}"
    if not artifacts:
        return f"{intro}\n\n- No artifacts were found for this estimate.\n\n{outro}"
    lines = [
        f"- {artifact['filename']} ({artifact.get('size_bytes') or 0} bytes)"
        for artifact in artifacts
    ]
    return "\n".join([intro, "", *lines, "", outro])


def extract_requirement_highlights(content: str, limit: int = 3):
    if not content:
        return []
    cleaned = re.sub(r"<[^>]+>", "\n", content.replace("&nbsp;", " "))
    lines = [line.strip() for line in cleaned.split("\n") if line.strip()]
    return lines[:limit]


def compose_wbs_rows(estimate_id: str):
    artifacts = fetch_artifacts(estimate_id)
    requirements_content = fetch_requirements_content(estimate_id)
    highlights = extract_requirement_highlights(requirements_content)

    rows = [
        {
            "taskCode": "DISC-101",
            "description": "Run discovery & alignment workshops with stakeholders.",
            "role": "Engagement Lead",
            "hours": 12,
            "assumptions": "Two sessions, 90 minutes each.",
        },
        {
            "taskCode": "ARCH-110",
            "description": "Draft solution architecture, risks, and dependencies.",
            "role": "Solutions Architect",
            "hours": 16,
            "assumptions": "Leverage prior architectures if applicable.",
        },
        {
            "taskCode": "PLAN-210",
            "description": "Translate requirements into role-based task plan.",
            "role": "Project Planner",
            "hours": 10,
            "assumptions": "Validated requirements available.",
        },
        {
            "taskCode": "BACK-330",
            "description": "Estimate backend/API build tasks aligned to scope.",
            "role": "Backend Engineer",
            "hours": 32,
            "assumptions": "CRUD + integrations scoped in requirements.",
        },
        {
            "taskCode": "QA-450",
            "description": "Define QA strategy and effort for regression/smoke.",
            "role": "QA Lead",
            "hours": 14,
            "assumptions": "Manual regression only for initial pass.",
        },
    ]

    for idx, highlight in enumerate(highlights):
        rows.append(
            {
                "taskCode": f"REQ-{idx + 1:03}",
                "description": f"Requirement deep dive: {highlight}",
                "role": "Business Analyst" if idx % 2 == 0 else "Technical Lead",
                "hours": 6 + idx * 2,
                "assumptions": "Assumes requirement remains in scope.",
            }
        )

    for artifact in artifacts[:2]:
        rows.append(
            {
                "taskCode": f"ART-{artifact['filename'][:3].upper()}",
                "description": f"Ingest {artifact['filename']} for estimation inputs.",
                "role": "Discovery Lead",
                "hours": 6,
                "assumptions": "Emphasize scope & constraints captured in artifact.",
            }
        )

    if len(rows) < 5:
        rows.append(
            {
                "taskCode": "BUF-999",
                "description": "General engineering buffer for spikes/risks.",
                "role": "Engineering Lead",
                "hours": 8,
                "assumptions": "Covers unforeseen clarifications.",
            }
        )

    return rows


def persist_wbs_rows(estimate_id: str, rows):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Supabase credentials missing for WBS generation.")

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    delete_response = requests.delete(
        f"{SUPABASE_URL}/rest/v1/estimate_wbs_rows",
        params={"estimate_id": f"eq.{estimate_id}"},
        headers=headers,
        timeout=10,
    )
    delete_response.raise_for_status()

    payload = [
        {
            "estimate_id": estimate_id,
            "task_code": row.get("taskCode"),
            "description": row.get("description"),
            "role": row.get("role"),
            "hours": row.get("hours", 0),
            "assumptions": row.get("assumptions"),
            "sort_order": idx,
          }
        for idx, row in enumerate(rows)
    ]

    if not payload:
        return

    insert_response = requests.post(
        f"{SUPABASE_URL}/rest/v1/estimate_wbs_rows",
        headers=headers,
        json=payload,
        timeout=10,
    )
    insert_response.raise_for_status()


@tool
def summarize_business_case(estimate_id: str):
    """
    Summarize the uploaded artifacts into a Business Case outline.
    """
    artifacts = fetch_artifacts(estimate_id)
    intro = "### Executive Summary\nCopilot reviewed the latest artifacts and captured the following signals:"
    outro = "Use these signals to finalize the Business Case stage."
    return summarize_from_artifacts(artifacts, intro, outro)


@tool
def summarize_requirements(estimate_id: str):
    """
    Translate artifacts into a Requirements checklist.
    """
    artifacts = fetch_artifacts(estimate_id)
    intro = "### Requirements Backlog\nEach uploaded artifact maps to at least one requirement:"
    outro = "Validate this list in the UI to unlock downstream stages."
    return summarize_from_artifacts(artifacts, intro, outro)

@tool
def generate_wbs(estimate_id: str):
    """
    Generate and persist a Work Breakdown Structure for the Effort Estimate stage.
    """
    rows = compose_wbs_rows(estimate_id)
    persist_wbs_rows(estimate_id, rows)
    return {
        "message": f"Generated {len(rows)} WBS rows",
        "rows": rows,
    }


@tool
def get_project_total(estimate_id: str):
    """
    Calculate the current quote total, factoring in role rates and per-task overrides.
    """
    rows = fetch_wbs_rows(estimate_id)
    if not rows:
        return {
            "message": "No WBS rows available. Approve a WBS first.",
            "total_cost": 0,
        }
    quote = fetch_quote_record(estimate_id) or {}
    rates = fetch_quote_rates(estimate_id)
    overrides = fetch_quote_overrides(estimate_id)
    rate_map = {
        (rate.get("role") or "").lower(): float(rate.get("rate") or 0)
        for rate in rates
    }
    override_map = {
        override.get("wbs_row_id"): float(override.get("rate") or 0)
        for override in overrides
    }
    currency = quote.get("currency", "USD")
    lines = []
    total_cost = 0.0
    total_hours = 0.0
    for row in rows:
        hours = float(row.get("hours") or 0)
        role = row.get("role") or ""
        override_rate = override_map.get(row.get("id"))
        base_rate = rate_map.get(role.lower(), DEFAULT_ROLE_RATE)
        rate = override_rate if override_rate and override_rate > 0 else base_rate
        cost = round(hours * rate, 2)
        total_cost += cost
        total_hours += hours
        lines.append(
            {
                "task_code": row.get("task_code"),
                "description": row.get("description"),
                "role": role,
                "hours": hours,
                "rate": rate,
                "cost": cost,
            }
        )
    return {
        "currency": currency,
        "total_cost": round(total_cost, 2),
        "total_hours": round(total_hours, 2),
        "payment_terms": quote.get("payment_terms"),
        "delivery_timeline": quote.get("delivery_timeline"),
        "lines": lines,
    }


@tool
def load_exemplar_contracts(contract_type: str):
    """
    Load exemplar agreements (MSA, SOW, NDA, etc.) for use in contract drafting/reviews.
    """
    exemplars = fetch_exemplar_contracts(contract_type)
    return {
        "type": contract_type,
        "count": len(exemplars),
        "exemplars": exemplars,
    }


@tool
def summarize_pushbacks(agreement_id: str):
    """
    Summarize policy conflicts and pushbacks from review proposals and notes for an agreement.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return {"error": "Supabase credentials missing"}
    try:
        # Fetch agreement notes
        notes_response = requests.get(
            f"{SUPABASE_URL}/rest/v1/contract_notes",
            params={
                "agreement_id": f"eq.{agreement_id}",
                "select": "note_text,created_at",
                "order": "created_at.desc",
                "limit": 10,
            },
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            timeout=10,
        )
        notes_response.raise_for_status()
        notes = notes_response.json() or []
        
        # Fetch agreement details
        agreement_response = requests.get(
            f"{SUPABASE_URL}/rest/v1/contract_agreements",
            params={
                "id": f"eq.{agreement_id}",
                "select": "type,counterparty,content",
            },
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            timeout=10,
        )
        agreement_response.raise_for_status()
        agreement_data = agreement_response.json()
        agreement = agreement_data[0] if agreement_data else {}
        
        summary_parts = [
            f"### Pushback Summary for {agreement.get('type', 'Agreement')} - {agreement.get('counterparty', 'Unknown')}",
            "",
        ]
        
        if notes:
            summary_parts.append("**Recent Notes:**")
            for note in notes[:5]:
                summary_parts.append(f"- {note.get('note_text', '')}")
        else:
            summary_parts.append("No notes found.")
        
        return {
            "summary": "\n".join(summary_parts),
            "note_count": len(notes),
        }
    except Exception as exc:
        return {
            "error": f"Unable to summarize pushbacks: {str(exc)}",
            "summary": "Error loading agreement data.",
        }


@tool
def add_agreement_note(agreement_id: str, note: str):
    """
    Add a note to an agreement, persisting it to Supabase.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return {"error": "Supabase credentials missing"}
    try:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/contract_notes",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json={
                "agreement_id": agreement_id,
                "note_text": note,
            },
            timeout=10,
        )
        response.raise_for_status()
        return {
            "message": f"Note added to agreement {agreement_id}",
            "note": note,
        }
    except Exception as exc:
        return {
            "error": f"Unable to add note: {str(exc)}",
        }


backend_tools = [
    summarize_business_case,
    summarize_requirements,
    generate_wbs,
    get_project_total,
    load_exemplar_contracts,
    summarize_pushbacks,
    add_agreement_note,
]

# Extract tool names from backend_tools for comparison
backend_tool_names = [tool.name for tool in backend_tools]


async def chat_node(state: AgentState, config: RunnableConfig) -> Command[Literal["tool_node", "__end__"]]:
    """
    Standard chat node based on the ReAct design pattern. It handles:
    - The model to use (and binds in CopilotKit actions and the tools defined above)
    - The system prompt
    - Getting a response from the model
    - Handling tool calls

    For more about the ReAct design pattern, see:
    https://www.perplexity.ai/search/react-agents-NcXLQhreS0WDzpVaS4m9Cg
    """

    # 1. Define the model
    model = ChatOpenAI(model="gpt-4o")

    # 2. Bind the tools to the model
    model_with_tools = model.bind_tools(
        [
            *state.get("tools", []), # bind tools defined by ag-ui
            *backend_tools,
            # your_tool_here
        ],

        # 2.1 Disable parallel tool calls to avoid race conditions,
        #     enable this for faster performance if you want to manage
        #     the complexity of running tool calls in parallel.
        parallel_tool_calls=False,
    )

    # 3. Define the system message by which the chat model will be run
    workflow = state.get("workflow")
    entity_type = state.get("entity_type")
    entity_id = state.get("entity_id")
    entity_data = state.get("entity_data") or {}
    
    # Build workflow-aware system prompt
    context_parts = []
    if workflow == "estimates":
        project_name = state.get("selected_project_name") or (entity_data.get("name") if entity_data else "Unknown Project")
        project_stage = state.get("selected_project_stage") or (entity_data.get("stage") if entity_data else "Unknown Stage")
        context_parts.append(f"You are assisting with the Estimates workflow.")
        context_parts.append(f"Current project: {project_name} (Stage: {project_stage})")
        context_parts.append("You can help with: generating business cases, requirements, WBS, calculating totals, adjusting hours, and adding line items.")
    elif workflow == "contracts":
        counterparty = entity_data.get("counterparty", "Unknown") if entity_data else "Unknown"
        agreement_type = entity_data.get("type", "Unknown") if entity_data else "Unknown"
        context_parts.append(f"You are assisting with the Contracts workflow.")
        context_parts.append(f"Current agreement: {agreement_type} for {counterparty}")
        context_parts.append("You can help with: reviewing drafts, summarizing pushbacks, adding notes, applying proposals, and validating against estimates.")
    else:
        context_parts.append("You are a helpful assistant for the VBT estimation and contracts platform.")
        context_parts.append("You can assist with both Estimates and Contracts workflows.")
    
    if entity_id:
        context_parts.append(f"Current entity ID: {entity_id}")
    
    system_content = "\n".join(context_parts)
    system_message = SystemMessage(content=system_content)

    # 4. Run the model to generate a response
    # Log interaction for AI_ARTIFACTS.md (development only)
    if os.environ.get("ENVIRONMENT") == "development":
        print(f"[Copilot] Workflow: {workflow}, Entity: {entity_id}, Type: {entity_type}")
        print(f"[Copilot] System prompt: {system_content[:200]}...")
    
    response = await model_with_tools.ainvoke([
        system_message,
        *state["messages"],
    ], config)
    
    # Log response for AI_ARTIFACTS.md
    if os.environ.get("ENVIRONMENT") == "development":
        tool_calls = getattr(response, "tool_calls", None)
        if tool_calls:
            print(f"[Copilot] Tool calls: {[tc.get('name') for tc in tool_calls]}")
        else:
            print(f"[Copilot] Response: {response.content[:200] if hasattr(response, 'content') else 'No content'}...")

    # only route to tool node if tool is not in the tools list
    if route_to_tool_node(response):
        print("routing to tool node")
        return Command(
            goto="tool_node",
            update={
                "messages": [response],
            }
        )

    # 5. We've handled all tool calls, so we can end the graph.
    return Command(
        goto=END,
        update={
            "messages": [response],
        }
    )

def route_to_tool_node(response: BaseMessage):
    """
    Route to tool node if any tool call in the response matches a backend tool name.
    """
    tool_calls = getattr(response, "tool_calls", None)
    if not tool_calls:
        return False

    for tool_call in tool_calls:
        if tool_call.get("name") in backend_tool_names:
            return True
    return False

# Define the workflow graph
workflow = StateGraph(AgentState)
workflow.add_node("chat_node", chat_node)
workflow.add_node("tool_node", ToolNode(tools=backend_tools))
workflow.add_edge("tool_node", "chat_node")
workflow.set_entry_point("chat_node")

graph = workflow.compile()

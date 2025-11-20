"""
This is the main entry point for the agent.
It defines the workflow graph, state, tools, nodes and edges.
"""

import os
import re
from datetime import datetime
from html import escape
from typing import Any, Dict, List, Optional
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


def supabase_json_headers(prefer: Optional[str] = None):
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def fetch_agreement_record(agreement_id: str) -> Optional[Dict[str, Any]]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/contract_agreements",
            params={
                "id": f"eq.{agreement_id}",
                "select": "id,type,counterparty,content,current_version,linked_estimate_id",
                "limit": "1",
            },
            headers=supabase_json_headers(),
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        return data[0] if data else None
    except Exception:
        return None


def fetch_latest_review_draft_content(agreement_id: str) -> Optional[str]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/contract_review_drafts",
            params={
                "agreement_id": f"eq.{agreement_id}",
                "select": "content,created_at",
                "order": "created_at.desc",
                "limit": "1",
            },
            headers=supabase_json_headers(),
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        if not data:
            return None
        return data[0].get("content")
    except Exception:
        return None


def generate_review_proposals_from_content(content: Optional[str]):
    proposals = []
    if not content:
        content = ""
    lower_content = content.lower()

    if "net 60" in lower_content:
        proposals.append(
            {
                "id": "prop-1",
                "before": "Payment terms: Net 60",
                "after": "Payment terms: Net 30",
                "rationale": "Policy requires Net 30 unless approved exception",
                "section": "Payment Terms",
            }
        )

    if "30 days notice" in lower_content or "30-day" in lower_content:
        proposals.append(
            {
                "id": "prop-2",
                "before": "Client may terminate with 30 days notice",
                "after": "Client may terminate with 60 days notice",
                "rationale": "Standard termination period per policy",
                "section": "Termination",
            }
        )

    if "change order" not in lower_content:
        proposals.append(
            {
                "id": "prop-3",
                "before": content[:100] + "..." if content else "",
                "after": "Any scope change request must be submitted in writing. VBT responds within five business days with fee, schedule, and service impacts.",
                "rationale": "Change order process required per policy",
                "section": "Change Management",
            }
        )

    if not proposals:
        proposals.append(
            {
                "id": "prop-4",
                "before": "Intellectual property rights remain with Client",
                "after": "Intellectual property rights remain with Client, except for VBT's pre-existing IP and general methodologies.",
                "rationale": "IP clause must protect VBT's pre-existing IP per policy",
                "section": "Intellectual Property",
            }
        )

    return proposals


def get_next_version_number(agreement_id: str, current_version: Optional[int] = None) -> int:
    if current_version:
        return current_version + 1
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return 1
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/contract_versions",
            params={
                "agreement_id": f"eq.{agreement_id}",
                "select": "version_number",
                "order": "version_number.desc",
                "limit": "1",
            },
            headers=supabase_json_headers(),
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        if not data:
            return 1
        return int(data[0].get("version_number", 0)) + 1
    except Exception:
        return 1


def insert_contract_version(
    agreement_id: str,
    version_number: int,
    content: str,
    notes: Optional[str],
):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Supabase credentials missing")
    payload = {
        "agreement_id": agreement_id,
        "version_number": version_number,
        "content": content,
        "notes": notes,
    }
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/contract_versions",
        headers=supabase_json_headers("return=representation"),
        json=payload,
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    return data[0] if data else payload


def update_contract_agreement_content(
    agreement_id: str,
    content: str,
    current_version: int,
):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Supabase credentials missing")
    payload = {
        "content": content,
        "current_version": current_version,
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }
    response = requests.patch(
        f"{SUPABASE_URL}/rest/v1/contract_agreements",
        params={"id": f"eq.{agreement_id}"},
        headers=supabase_json_headers("return=representation"),
        json=payload,
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    return data[0] if data else payload


def add_system_note(agreement_id: str, note_text: str):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/contract_notes",
        headers=supabase_json_headers("return=representation"),
        json={
            "agreement_id": agreement_id,
            "note_text": note_text,
            "created_by": "Copilot",
        },
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    return data[0] if data else None


def apply_proposals_to_content(current_content: str, proposals: List[Dict[str, Any]]):
    result = current_content or ""
    applied = []
    appended = []
    for proposal in proposals:
        before = proposal.get("before") or ""
        after = proposal.get("after") or ""
        proposal_id = proposal.get("id")
        if before and before in result:
            result = result.replace(before, after, 1)
            applied.append(proposal_id)
        else:
            result = f"{result}\n\n{after}"
            appended.append(proposal_id)
    return result, applied, appended


def fetch_estimate_summary(estimate_id: str) -> Optional[Dict[str, Any]]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/estimates",
            params={
                "id": f"eq.{estimate_id}",
                "select": "id,name,owner,stage",
                "limit": "1",
            },
            headers=supabase_json_headers(),
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        if not data:
            print(f"[Copilot][fetch_estimate_summary] Empty response for {estimate_id}: {response.text}")
        return data[0] if data else None
    except Exception as exc:
        print(f"[Copilot][fetch_estimate_summary] Error for {estimate_id}: {exc}")
        return None


def fetch_business_case_content(estimate_id: str) -> str:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return ""
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/estimate_business_case",
            params={
                "estimate_id": f"eq.{estimate_id}",
                "select": "content",
                "limit": "1",
            },
            headers=supabase_json_headers(),
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        if not data:
            return ""
        return data[0].get("content") or ""
    except Exception:
        return ""


def _html_list(items: List[str]) -> str:
    if not items:
        return "<p>Pending input.</p>"
    return "<ul>" + "".join(f"<li>{escape(item)}</li>" for item in items) + "</ul>"


def _html_list_raw(items: List[str]) -> str:
    """HTML list that doesn't escape items (for HTML content)"""
    if not items:
        return "<p>Pending input.</p>"
    return "<ul>" + "".join(f"<li>{item}</li>" for item in items) + "</ul>"


def _section(title: str, body: str) -> str:
    """Section with escaped title but raw HTML body"""
    return f"<h2>{escape(title)}</h2>{body}"


def _section_raw(title: str, body: str) -> str:
    """Section with raw HTML title and body"""
    return f"<h2>{title}</h2>{body}"


def _paragraph(text: str) -> str:
    return f"<p>{escape(text)}</p>"


def _paragraph_html(html: str) -> str:
    """Paragraph that accepts raw HTML (doesn't escape)"""
    return f"<p>{html}</p>"


def build_msa_content(
    estimate: Dict[str, Any],
    business_case: str,
    requirements_highlights: List[str],
    quote_summary: Dict[str, Any],
    counterparty: str,
) -> str:
    """
    Build MSA content following the exemplar structure with all standard legal sections.
    """
    effective_date = datetime.utcnow()
    effective_date_str = effective_date.strftime("%B %d, %Y")
    payment_terms = quote_summary.get("payment_terms") or "Net 30"
    currency = quote_summary.get("currency", "USD")
    total_cost = quote_summary.get("total_cost", 0)
    
    # Build MSA following exemplar structure
    body = [
        "<h1>MASTER SERVICE AGREEMENT</h1>",
        "",
        _paragraph_html(
            f"This Master Service Agreement (the \"Agreement\" or \"MSA\") is entered into "
            f"this {effective_date.strftime('%d')} day of {effective_date.strftime('%B')}, "
            f"{effective_date.year} (\"Effective Date\"), by and between "
            f"<strong>Very Big Things, LLC</strong>, a Florida limited liability company, having "
            f"its principal place of business at 837 Northeast 2<sup>nd</sup> Avenue, "
            f"Fort Lauderdale, FL 33304 (\"VBT\"), and <strong>{escape(counterparty)}</strong> "
            f"(the \"Client\"), in order to clearly define the design, development and "
            f"implementation of the service(s) or product(s) to be provided by VBT, as "
            f"well as the ongoing terms of this agreement."
        ),
        "",
        _section_raw(
            "<strong>1. PERFORMANCE OF SERVICES.</strong>",
            _paragraph(
                f"VBT will provide the Client with ongoing consulting and development services "
                f"as more fully described in one or more statement(s) of work (the \"SOW\"), "
                f"the initially accepted SOWs are attached hereto as Exhibits A and B "
                f"(collectively, the \"Services\"). Each SOW when executed by both the Client "
                f"and VBT shall form a part of this MSA and be subject to the terms and conditions "
                f"set forth herein. Services performed under a particular SOW along with any "
                f"associated deliverables, including but not limited to UX/UI designs, drawings, "
                f"documentation, software code, etc., shall constitute a \"Project.\" Any "
                f"modification or addition to the Services desired by the Client must be agreed to "
                f"in writing by both parties and reduced to a SOW and incorporated into this Agreement."
            ),
        ),
        "",
        _section_raw(
            "<strong>2. CLIENT COOPERATION.</strong>",
            _paragraph(
                "Client acknowledges and agrees that the timely provision of assistance, cooperation, "
                "and complete and accurate information and data from Client's officers, agents and "
                "employees is essential to VBT's performance of the Services. Client's obligations "
                "under this paragraph 2 shall include:"
            ) +
            _html_list([
                "Setting the overall direction on the Services to be performed, including making choices on priorities and direction;",
                "Providing the necessary Client personnel and management involvement, including attendance at meetings and workshops, to support the Services and allow for decisions to be made on a timely basis without undue delay; and",
                "Providing timely access to complete and accurate data sets required for AI analysis as is necessary for the performance of the Services.",
            ]) +
            _paragraph(
                "VBT shall not be liable for any deficiency in performing the Services if such "
                "deficiency results from Client's failure to meet the above obligations in a "
                "commercially reasonable manner. VBT shall inform Client in a timely manner of any "
                "failure of these obligations it becomes aware of."
            ),
        ),
        "",
        _section_raw(
            "<strong>3. PERSONNEL.</strong>",
            _paragraph(
                "VBT reserves the exclusive right to make all decisions regarding which VBT personnel "
                "are staffed on providing Services as well as to allow the assignment of subcontractors "
                "to ensure that the terms of this Agreement and the Services are met as well as "
                "on-time completion. However, Client in its discretion may request removal of any "
                "VBT personnel or subcontractors who are providing Services under this Agreement. "
                "If such a request is made VBT and Client will work together to reach a mutually "
                "agreeable solution to honor such request and minimize any impact on the Services."
            ),
        ),
        "",
        _section_raw(
            "<strong>4. PAYMENT TERMS.</strong>",
            _paragraph_html(
                "<strong>4.1</strong> Client shall pay VBT pursuant to the terms of any SOW. Any "
                f"amounts not paid by the due date stated in the SOW shall be subject to an additional "
                f"finance charge of 1.5% monthly. VBT reserves the right to use any and all means of "
                f"collection available under applicable law to collect any amount past due and Client "
                f"shall pay all reasonable attorney's fees or collections agency fees. VBT may suspend "
                f"Services and/or terminate this Agreement and/or any SOW if Client's account is more "
                f"than fifteen (15) days past due."
            ) +
            _paragraph_html(
                "<strong>4.2</strong> The fees set forth in this Agreement shall cover and include all "
                "sales and use taxes, duties, and charges of any kind imposed by any federal, state, or "
                "local governmental authority on amounts payable by Client under this Agreement, and in "
                "no event shall Client be required to pay any additional amount to VBT in connection "
                "with such taxes, duties, and charges, or any taxes imposed on, or regarding, VBT's "
                "income, revenues, gross receipts, personnel, or real or personal property or other assets."
            ),
        ),
        "",
        _section_raw(
            "<strong>5. COPYRIGHT AND TRADEMARKS.</strong>",
            _paragraph(
                "Each party unconditionally guarantees that any elements of text, graphics, photos, "
                "designs, trademarks, or other artwork furnished by such party for inclusion in any "
                "Project are owned by such party, or alternatively, that such party has permission "
                "from the rightful owner to use each of these elements, and will hold harmless, protect, "
                "indemnify and defend the non-furnishing party and its subcontractors from any liability "
                "(including attorney's fees and court costs), including any claim or suit, threatened or "
                "actual, arising from the use of such elements."
            ),
        ),
        "",
        _section_raw(
            "<strong>6. INTELLECTUAL PROPERTY</strong>.",
            _paragraph_html(
                "<strong>6.1 Client Intellectual Property</strong>. All concepts, designs, improvements, "
                "derivative works, inventions, work product, and/or original works of authorship, created "
                "by VBT as part of the performance of the Services, and which relate specifically to the "
                "Client's data and data analytics (the \"Client IP\") shall be considered \"work for hire\" "
                "to the maximum extent permitted by United States law. If for any reason any element of the "
                "Client IP is not deemed to be work made for hire, then VBT agrees to assign and does "
                "hereby assign to Client all right, title, and interest in and to such Client IP on a "
                "perpetual, exclusive, worldwide, sublicensable, and royalty-free basis, and agrees to "
                "provide all assistance requested by Client in the establishment, preservation and "
                "enforcement of such rights, provided that such assistance will be provided at Client's "
                "expense. If VBT has any rights, including without limitation \"moral rights\" (or rights "
                "of \"droit moral\") in any Client IP that cannot be assigned, VBT hereby waives any such "
                "rights in perpetuity and agrees that it will not seek to enforce such rights against "
                "Client in any location. VBT has no right or license to use the Client's trademarks, "
                "service marks, trade names, logos, symbols, or brand names beyond approved use in any "
                "deliverables."
            ) +
            _paragraph_html(
                "<strong>6.2 Pre-existing Materials</strong>. Notwithstanding Section 6.1, to the extent "
                "that any of VBT's pre-existing materials are incorporated in or combined with any "
                "deliverables from the performance of the Services or otherwise necessary for the use or "
                "exploitation of the Services, VBT hereby grants to the Client an irrevocable, worldwide, "
                "perpetual, royalty-free, non-exclusive license to use, publish, reproduce, perform, display, "
                "distribute, modify, prepare derivative works based upon, make, have made, sell, offer to "
                "sell, import, and otherwise exploit such preexisting materials and derivative works thereof. "
                "The Client may assign, transfer, and sublicense such rights to others without VBT's approval."
            ) +
            _paragraph_html(
                "<strong>6.3 Third Party Intellectual Property</strong>. Client acknowledges that the "
                "deliverables from the performance of the Services may contain certain intellectual property "
                "that was not created by VBT or Client, including, but not limited to, any open-source code "
                "software (\"Third Party IP\"). VBT may utilize and incorporate Third Party IP provided that: "
                "(a) VBT has obtained a sufficient license to allow the unrestricted exploitation by Client "
                "of such Third Party IP, including without limitation reproduction, the creation of derivative "
                "works, and unrestricted sub-licensing, and (b) such Third Party IP does not unreasonably "
                "encumber the deliverables."
            ),
        ),
        "",
        _section_raw(
            "<strong>7. CONFIDENTIAL INFORMATION.</strong>",
            _paragraph_html(
                "<strong>7.1 Confidential Information.</strong> Each party acknowledges that in connection "
                "with this Agreement it may receive certain confidential or proprietary technical and business "
                "information and materials of the other party, including, without limitation, computer programs, "
                "code, algorithms, know-how, formulas, processes, ideas, inventions (whether patentable or not), "
                "and other technical, business, financial and product development plans, strategies, and "
                "information (\"Confidential Information\"). Notwithstanding the foregoing, Confidential "
                "Information shall not include any information that is in the public domain or becomes publicly "
                "known through no fault of the receiving party, or is otherwise properly received from a third "
                "party without an obligation of confidentiality, or was known to either party prior to this Agreement."
            ) +
            _paragraph_html(
                "<strong>7.2 Protections.</strong> Each party, its agents and employees shall hold and maintain "
                "in strict confidence all Confidential Information, shall not disclose Confidential Information "
                "to any third party, and shall not use any Confidential Information except as may be necessary "
                "to perform its obligations under this Agreement, or as may be required by a court or "
                "governmental authority. Should either party become aware of such mandatory disclosure, it will "
                "immediately advise the other party of such requirement and allow such party the opportunity to contest it."
            ) +
            _paragraph_html(
                "<strong>7.3 Promotion.</strong> Subject to the restrictions on Confidential Information and "
                "Client's prior written agreement, VBT may display screenshots and information of any Project "
                "in its portfolios, marketing, or promotional materials, and to submit the Project for review "
                "in competitions."
            ) +
            _paragraph_html(
                "<strong>7.4 Return of Confidential Information.</strong> Immediately upon a request by Client "
                "at any time, VBT will turn over all documents or media containing Confidential Information and "
                "all copies or extracts thereof and will promptly and permanently delete any Confidential "
                "Information which is electronically or optically recorded to stored."
            ),
        ),
        "",
        _section_raw(
            "<strong>8. TERM AND TERMINATION.</strong>",
            _paragraph_html(
                "<strong>8.1</strong> Term of Agreement. This Agreement shall remain in full force and effect "
                "for a term of one (1) year following the Effective Date or termination of the last SOW, "
                "whichever is later (collectively, the \"Term\") unless earlier terminated as provided herein."
            ) +
            _paragraph_html(
                "<strong>8.2</strong> Either party may terminate this Agreement and/or any individual SOW upon "
                "thirty (30) days written notice to the other party. Client or VBT may terminate this Agreement "
                "and/or any individual SOW, effective immediately upon written notice to the other party to this "
                "Agreement, if the other party materially breaches this Agreement and/or any individual SOW, and "
                "such breach is incapable of cure, or with respect to a material breach capable of cure, the "
                "other party does not cure such breach within 10 business days after receipt of written notice "
                "of such breach. The termination of any individual SOW shall not constitute a termination of the "
                "entirety of this Agreement unless specifically stated in such notice. Client shall pay VBT for "
                "all Services provided up through the date of termination."
            ) +
            _paragraph_html(
                "<strong>8.3</strong> Upon expiration or termination of this Agreement for any reason, or at any "
                "other time upon the Client's written request, VBT shall promptly after such expiration or termination:"
            ) +
            _html_list([
                "(a) deliver to the Client all deliverables (whether complete or incomplete) and all materials, equipment, and other property provided for VBT's use by the Client;",
                "(b) deliver to the Client all tangible documents and other media, including any copies, containing, reflecting, incorporating, or based on the Confidential Information;",
                "(c) permanently delete all Confidential Information stored electronically in any form, including on computer systems, networks, and devices such as cell phones; and",
                "(d) certify in writing to the Client that VBT has complied with the requirements of this clause.",
            ]) +
            _paragraph_html(
                "<strong>8.4</strong> The terms and conditions of this clause and Section 6, Section 7, Section 8, "
                "Section 15, Section 16, Section 17, Section 19, and Section 23 shall survive the expiration or "
                "termination of this Agreement."
            ),
        ),
        "",
        _section_raw(
            "<strong>9. REPRESENTATIONS AND WARRANTIES.</strong>",
            _paragraph_html(
                "<strong>9.1</strong> VBT represent and warrant to the Client that:"
            ) +
            _html_list([
                "(a) VBT have the right to enter into this Agreement, to grant the rights granted herein, and to perform fully all of VBT's obligations in this Agreement;",
                "(b) VBT is entering into this Agreement with the Client and VBT's performance of the Services do not and will not conflict with or result in any breach or default under any other agreement to which VBT is subject;",
                "(c) VBT has the required skill, experience, and qualifications to perform the Services, VBT shall perform the Services in a professional and workmanlike manner in accordance with generally recognized industry standards for similar services, and VBT shall devote sufficient resources to ensure that the Services are performed in a timely and reliable manner;",
                "(d) VBT has or shall implement and maintain a written information security program, including appropriate policies, procedures, and risk assessments that are reviewed at least annually;",
                "(d) VBT shall perform the Services in compliance with all applicable federal, state, and local laws and regulations, including by maintaining all licenses, permits, and registrations required to perform the Services;",
                "(e) the Client will receive good and valid title to all deliverables, free and clear of all encumbrances and liens of any kind; and",
                "(f) all deliverables shall be VBT original work (except for material in the public domain or provided by the Client) and does not and will not violate or infringe upon the intellectual property right or any other right whatsoever of any person, firm, corporation, or other entity.",
            ]) +
            _paragraph_html(
                "<strong>9.2</strong> The Client hereby represents and warrants to VBT that:"
            ) +
            _html_list([
                "(a) it has the full right, power, and authority to enter into this Agreement and to perform its obligations hereunder; and",
                "(b) the execution of this Agreement by its representative whose signature is set forth at the end of this Agreement has been duly authorized by all necessary corporate action.",
            ]),
        ),
        "",
        _section_raw(
            "<strong>10. INFORMATION SECURITY.</strong>",
            _paragraph_html(
                "<strong>10.1</strong> VBT represents and warrants that its creation, collection, receipt, access, "
                "use, storage, disposal, and disclosure of Personal Information does and will comply with all "
                "applicable federal and state privacy and data protection laws, as well as all other applicable "
                "regulations and directives. \"Personal Information\" means information provided to VBT by or at "
                "the direction of Client, information which is created or obtained by VBT on behalf of Client, in "
                "the course of VBT's performance under this Agreement that (i) identifies or can be used to "
                "identify an individual (including, without limitation, names, signatures, addresses, telephone "
                "numbers, email addresses, and other unique identifiers); or (ii) can be used to authenticate an "
                "individual (including, without limitation, government-issued identification numbers, biometric, "
                "health, genetic, medical, or medical insurance data, and other personal identifiers)."
            ) +
            _paragraph_html(
                "<strong>10.2</strong> VBT shall notify Client of a Security Breach as soon as practicable, but no "
                "later than twenty-four (24) hours after VBT becomes aware of it. Immediately following VBT's "
                "notification to Client of a Security Breach, the parties shall coordinate with each other to "
                "investigate the Security Breach. Immediately following VBT's notification to Client of a Security "
                "Breach, the parties shall coordinate with each other to investigate the Security Breach in "
                "accordance with VBT's standard policies and procedures. As used herein \"Security Breach\" means "
                "(i) any act or omission that compromises either the security, confidentiality, or integrity of "
                "Personal Information or the physical, technical, administrative, or organizational safeguards put "
                "in place by VBT, or by Client should VBT have access to Client's systems, that relate to the "
                "protection of the security, confidentiality, or integrity of Personal Information. Without limiting "
                "the foregoing, a compromise shall include any unauthorized access to or disclosure or acquisition of Personal Information."
            ) +
            _paragraph_html(
                "<strong>10.3</strong> Personal Information is deemed to be Confidential Information of Client and "
                "is not Confidential Information of VBT. In the event of a conflict or inconsistency between this "
                "Section and confidentiality sections of this Agreement, the terms and conditions of this Agreement, "
                "the terms and conditions set forth in this Section shall govern and control."
            ) +
            _paragraph_html(
                "<strong>10.4</strong> At a minimum, VBT's safeguards for protecting Personal Information shall "
                "include: (i) limiting access of Personal Information to Authorized Persons; (ii) securing business "
                "facilities, data centers, paper files, servers, backup systems, and computing equipment, including, "
                "but not limited to, all mobile devices and other equipment with information storage capability; "
                "(iii) implementing network, application, database, and platform security; (iv) securing information "
                "transmission, storage, and disposal; (v) implementing authentication and access controls within media, "
                "applications, operating systems, and equipment, including the use of phishing-resistant multifactor "
                "authentication for access to any Personal Information; (vi) encrypting Personal Information stored on "
                "any media; (vii) encrypting Personal Information when transmitted; (viii) strictly segregating "
                "Personal Information from information of VBT or its other customers so that Personal Information is "
                "not commingled with any other types of information; (ix) conducting risk assessments, penetration "
                "testing, and vulnerability scans and promptly implementing, at VBT's sole cost and expense, a "
                "corrective action plan to correct any issues that are reported as a result of the testing; (x) "
                "implementing appropriate personnel security and integrity procedures and practices, including, but "
                "not limited to, conducting background checks consistent with applicable law; and (xi) providing "
                "appropriate privacy and information security training to VBT's employees."
            ) +
            _paragraph_html(
                "<strong>10.5</strong> Upon Client's request, VBT grants Client or, upon Client's election, a third "
                "party on Client's behalf, permission to assess the effectiveness of VBT's information security "
                "program, compliance with this Agreement, as well as any applicable laws, regulations, and industry standards."
            ),
        ),
        "",
        _section_raw(
            "<strong>11. INDEMNITY.</strong>",
            _paragraph(
                "The Client agrees to indemnify and hold harmless VBT and its affiliates, successors and assigns, "
                "from all claims, costs, expenses, liabilities, or damages arising from any materials approved "
                "and provided by the Client, or any breach of representation, warranty, or obligation under this "
                "Agreement. Similarly, VBT agrees to indemnify and hold harmless the Client and its affiliates, "
                "successors and assigns, from all claims, costs, expenses, liabilities, or damages arising from "
                "any materials approved and provided by VBT, including but not limited to any Third Party IP and "
                "Framework IP, any breach of representation, warranty, or obligation under this Agreement. This "
                "indemnity shall extend, but not be limited, to all claims, loss or expenses arising from inaccurate "
                "or incomplete information provided by either party. Client may satisfy such indemnity (in whole or "
                "in part) by way of deduction from any payment due to VBT."
            ),
        ),
        "",
        _section_raw(
            "<strong>12. LIMITATION OF LIABILITY</strong>",
            _paragraph_html(
                "<strong>12.1. General Limitation</strong>. VBT's aggregate liability to Client for any damages "
                "in connection with this Agreement and the Services or any deliverables provided pursuant to this "
                "Agreement, regardless of the form of action giving rise to such liability (under any theory, "
                "whether in contract, tort, statutory or otherwise) shall not exceed the total of the amounts "
                "paid by Client to VBT pursuant to this agreement in the 12 month period preceding the event giving "
                "rise to the claim."
            ) +
            _paragraph_html(
                "<strong>12.2. Limitation on Special Damages</strong>. Neither party shall be liable to the other "
                "for any lost profits, lost savings or other incidental, consequential, punitive, or special damages "
                "in connection with this Agreement, even if the party has been advised of the possibility of such damages."
            ) +
            _paragraph_html(
                "<strong>12.3. Force Majeure</strong>. No party shall be liable or responsible to the other party, "
                "or deemed to have defaulted under or breached this Agreement, for any failure or delay in fulfilling "
                "any term of the Agreement, when and to the extent such party's (the \"Impacted Party\") failure or "
                "delay is caused by or results from the following force majeure events (\"Force Majeure\") (a)any "
                "circumstances beyond the reasonable control of the Impacted Party; (b) Acts of God (c) flood, fire, "
                "earthquake or other potential disasters, such as epidemics; (d) government order, law, or action; "
                "(e) national or regional emergencies; or (f) telecommunication breakdowns, power outages or shortages. "
                "VBT does not guarantee page download speed, or bandwidth levels."
            ),
        ),
        "",
        _section_raw(
            "<strong>13. THIRD PARTY SERVICES.</strong>",
            _paragraph(
                "The Client understands that VBT will not provide nor pay for any hosting services, CMS, LLM or CRM "
                "services in connection with this project. Any of these services require a separate contract with "
                "the service of the Client's choice. The Client agrees to select a hosting service, which allows "
                "VBT full access to the Client's account via FTP (File Transfer Protocol) or SSH. The Client will "
                "be solely responsible for any and all such service charges."
            ),
        ),
        "",
        _section_raw(
            "<strong>14. INSURANCE</strong>.",
            _paragraph(
                "During the Term, VBT shall maintain in force workers' compensation insurance with limits no less "
                "than the minimum amount required by applicable law, commercial general liability with limits no less "
                "than $1,000,000.00 for each occurrence, errors and omissions, and other forms of insurance, in each "
                "case with insurers reasonably acceptable to the Client, with policy limits sufficient to protect and "
                "indemnify the Client and its affiliates, and each of their officers, directors, agents, employees, "
                "subsidiaries, partners, members, controlling persons, and successors and assigns, from any losses "
                "resulting from VBT's acts or omissions or the acts or omissions of VBT's agents, contractors, servants, or employees."
            ),
        ),
        "",
        _section_raw(
            "<strong>15. EXPENSES.</strong>",
            _paragraph(
                "The Client shall reimburse VBT for pre-approved expenses incurred in performing the Services that "
                "have been approved in advance by the Client. Travel expenses shall include transportation costs as "
                "well as a per diem amount to be approved in advance by the Client."
            ),
        ),
        "",
        _section_raw(
            "<strong>16. RELATIONSHIP OF THE PARTIES.</strong>",
            _paragraph(
                "This Agreement shall not be construed as creating an agency, partnership, joint venture or any other "
                "form of association, for tax purposes or otherwise, between the parties, and the parties shall at all "
                "times be and remain independent contractors. Except as expressly agreed by the parties in writing, "
                "neither party shall have any right or authority, express or implied, to assume or create any obligation "
                "of any kind, or to make any representation or warranty, on behalf of the other party or to bind the "
                "other party in any respect whatsoever."
            ),
        ),
        "",
        _section_raw(
            "<strong>17. NON-SOLICITATION</strong>.",
            _paragraph(
                "Both parties agree that during the Term of this Agreement and for a period of twelve months following "
                "the termination or expiration of this Agreement, neither party shall make any solicitation to employ "
                "the other party's personnel without the prior written consent of such other party. For the purposes "
                "of this paragraph, a general advertisement or notice of a job listing or opening or other similar "
                "general publication of a job search or availability to fill employment positions, including on the "
                "Internet, shall not be construed as a solicitation or inducement, and the hiring of any such employees "
                "or independent contractor who freely responds thereto shall not be a breach of this paragraph."
            ),
        ),
        "",
        _section_raw(
            "<strong>18. NOTICE</strong>.",
            _paragraph(
                "All notices, requests, consents, claims, demands, waivers, and other communications hereunder (each, "
                "a \"Notice\") shall be in writing and addressed to the Parties at the addresses set forth on the first "
                "page of this Agreement (or to such other address that may be designated by the receiving party from "
                "time to time in accordance with this Section). All Notices shall be delivered by personal delivery, "
                "nationally recognized overnight courier (with all fees prepaid), or certified or registered mail (in "
                "each case, return receipt requested, postage prepaid). Except as otherwise provided in this Agreement, "
                "a Notice is effective only if: (a) the receiving party has received the Notice; and (b) the party giving "
                "the Notice has complied with the requirements of this Section."
            ),
        ),
        "",
        _section_raw(
            "<strong>19. INTEGRATION AND SEVERABILITY.</strong>",
            _paragraph_html(
                "<strong>19.1.</strong> This Agreement and any exhibits hereto supersede all prior discussions and "
                "writings and constitute the entire understanding and agreement between VBT and the Client. Any "
                "additional desired Services not specified in this Agreement, must be authorized by a written request "
                "signed by both Client and VBT and added to this Agreement as an additional SOW. If any provision of "
                "this Agreement or any SOW is held by a court of competent jurisdiction to be unenforceable for any "
                "reason, the remaining provisions shall be unaffected and remain in full force and effect."
            ) +
            _paragraph_html(
                "<strong>19.2.</strong> This Agreement may only be amended, modified, or supplemented by an agreement "
                "in writing signed by each party hereto, and any of the terms thereof may be waived, only by a written "
                "document signed by each party to this Agreement or, in the case of waiver, by the party or parties waiving compliance"
            ),
        ),
        "",
        _section_raw(
            "<strong>20. GOVERNING LAW.</strong>",
            _paragraph(
                "This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, "
                "without giving effect to any conflict of laws principles that would cause the laws of any other jurisdiction to apply."
            ),
        ),
        "",
        _section_raw(
            "<strong>21. PREVAILING PARTY</strong>.",
            _paragraph_html(
                "In any dispute resolution proceeding between the parties in connection with this Agreement, the "
                "prevailing party will be entitled to recover its reasonable attorney's fees and costs in such proceeding "
                "from the other party."
            ),
        ),
        "",
        _section_raw(
            "<strong>22. ASSIGNMENT</strong>.",
            _paragraph_html(
                "No right or obligation under this Agreement may be assigned, delegated or otherwise transferred, without "
                "the express prior written consent of both parties. Subject to the preceding sentence, this Agreement "
                "shall bind each party and its permitted successors and assigns."
            ),
        ),
        "",
        _section_raw(
            "<strong>23. COUNTERPARTS</strong>.",
            _paragraph_html(
                "This Agreement and any SOW may be executed in several counterparts, all of which shall constitute one agreement."
            ),
        ),
        "",
        _section_raw(
            "<strong>24. WAIVER OF JURY TRIAL</strong>.",
            _paragraph_html(
                "EACH PARTY HERETO HEREBY WAIVES, TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, ANY RIGHT IT MAY "
                "HAVE TO A TRIAL BY JURY IN ANY LEGAL PROCEEDING DIRECTLY OR INDIRECTLY ARISING OUT OF OR RELATING TO "
                "THIS AGREEMENT, ANY SOW OR THE TRANSACTIONS CONTEMPLATED HEREBY OR THEREBY (WHETHER BASED ON CONTRACT, "
                "TORT OR ANY OTHER THEORY). EACH PARTY (A) CERTIFIES THAT NO REPRESENTATIVE, AGENT OR ATTORNEY OF ANY "
                "OTHER PARTY HAS REPRESENTED, EXPRESSLY OR OTHERWISE, THAT SUCH OTHER PARTY WOULD NOT, IN THE EVENT OF "
                "LITIGATION, SEEK TO ENFORCE THE FOREGOING WAIVER AND (B) ACKNOWLEDGES THAT IT AND THE OTHER PARTIES "
                "HERETO HAVE BEEN INDUCED TO ENTER INTO THIS AGREEMENT BY, AMONG OTHER THINGS, THE MUTUAL WAIVERS AND "
                "CERTIFICATIONS IN THIS SECTION."
            ),
        ),
        "",
        "<p><strong>[SIGNATURES BEGIN ON NEXT PAGE]</strong></p>",
        "",
        "<p>In witness whereof, the parties have caused this Agreement to be executed by their duly authorized "
        "representatives, as of the date first written above.</p>",
        "",
        "<table><colgroup><col style=\"width: 50%\" /><col style=\"width: 50%\" /></colgroup>"
        "<thead><tr class=\"header\"><th><p><strong>Very Big Things, LLC</strong></p>"
        "<p>______________________________</p><p><strong><br /></strong>By: __________________________</p>"
        "<p>Title: __________________________</p></th>"
        "<th><p><strong>{}</strong></p><p>______________________________</p>"
        "<p><strong><br /></strong>By: __________________________</p>"
        "<p>Title: __________________________</p></th></tr></thead><tbody></tbody></table>".format(escape(counterparty)),
    ]
    return "".join(body)


def build_sow_content(
    estimate: Dict[str, Any],
    wbs_rows,
    quote_summary: Dict[str, Any],
    counterparty: str,
) -> str:
    """
    Build SOW content following the exemplar structure with professional sections.
    """
    total_hours = quote_summary.get("total_hours", 0)
    currency = quote_summary.get("currency", "USD")
    total_cost = quote_summary.get("total_cost", 0)
    payment_terms = quote_summary.get("payment_terms") or "Net 30"
    delivery_timeline = quote_summary.get("delivery_timeline") or "Delivery within 8 weeks"
    
    # Calculate average hourly rate
    avg_rate = (total_cost / total_hours) if total_hours > 0 else 0
    billing_cycle = "2 week" if payment_terms.startswith("Net 15") else "monthly"
    
    # Format WBS by role/category
    wbs_by_category = {}
    for row in wbs_rows:
        role = row.get('role', 'Other')
        if role not in wbs_by_category:
            wbs_by_category[role] = []
        wbs_by_category[role].append(row)
    
    # Build detailed WBS section
    wbs_sections = []
    for role, rows in wbs_by_category.items():
        role_items = []
        for row in rows:
            task_code = escape(row.get('task_code') or '')
            description = escape(row.get('description') or '')
            hours = row.get('hours', 0)
            role_items.append(f"{task_code} – {description} ({hours}h)")
        wbs_sections.append(f"<p><strong>{escape(role)}:</strong></p><ul>" + 
                          "".join(f"<li>{item}</li>" for item in role_items) + "</ul>")
    
    wbs_content = "".join(wbs_sections) if wbs_sections else _paragraph("Work Breakdown Structure will be finalized after estimate approval.")

    # Build SOW following exemplar structure (without EXHIBIT header)
    body = [
        f"<h1>Very Big Things, LLC. STATEMENT OF WORK</h1>",
        "",
        _section_raw(
            "<strong>INTRODUCTION/BACKGROUND</strong>",
            _paragraph(
                f"The following Statement of Work (SOW) shall serve to outline the current "
                f"scope of work required for {escape(counterparty)} (\"Client\"), involving "
                f"Very Big Things, LLC (\"VBT\") and is made pursuant to the Master Service "
                f"Agreement between the parties dated {datetime.utcnow().strftime('%B %d, %Y')} (the \"MSA\")."
            ),
        ),
        "",
        _section_raw(
            "<strong>SCOPE</strong>",
            _paragraph(
                f"{escape(estimate.get('name', 'Project'))}: {escape(estimate.get('description', 'Deliver a production-ready implementation as specified in the requirements and business case.'))}"
            ),
        ),
        "",
        _section_raw(
            "<strong>1. Work Breakdown Structure</strong>",
            wbs_content,
        ),
        "",
        _section_raw(
            "<strong>2. Deliverables</strong>",
            _html_list([
                "All deliverables as specified in the approved requirements and business case.",
                "Production-ready implementation with documentation.",
                "Handover materials and knowledge transfer sessions.",
            ]),
        ),
        "",
        _section_raw(
            "<strong>INTELLECTUAL PROPERTY</strong>",
            _paragraph(
                "In addition to the intellectual property rights defined in the MSA, all "
                "right, title and interest to all concepts, designs, improvements, "
                "derivative works, inventions, and/or original works of authorship, "
                "created by VBT as part of VBT's core generative AI business intelligence "
                "platform, shall remain the exclusive property of VBT. VBT agrees to grant "
                "and does hereby grant to Client a nonexclusive, royalty-free, perpetual, "
                "license to use any of the VBT IP."
            ),
        ),
        "",
        _section_raw(
            "<strong>ESTIMATED COST & TIMELINE</strong>",
            _paragraph(
                f"Fees shall be billed hourly at an average rate of {currency} {avg_rate:.2f}/hr. "
                f"and invoiced in {billing_cycle} billing cycles. The estimated cost to complete "
                f"this engagement is {currency} {total_cost:,.2f} (approximately {total_hours} hours), "
                f"with an estimated timeline of {delivery_timeline}."
            ),
        ),
        "",
        _section_raw(
            "<strong>DEPOSIT</strong>",
            _paragraph(
                f"A deposit equal to {currency} {total_cost * 0.2:,.2f} (20% of estimated total), "
                f"shall be paid within five (5) business days of the execution of this SOW. "
                f"If at any time the Client wishes to terminate this SOW pursuant to the MSA, "
                f"the deposit shall be applied pro-rata to all outstanding time committed by VBT, "
                f"and the remaining deposit amount, if any, shall be refunded to the Client. "
                f"Upon completion of the work to be performed under this SOW the deposit, "
                f"at the Client's discretion, may either be returned to the Client or applied "
                f"to any upcoming invoice or future work."
            ),
        ),
        "",
        _section_raw(
            "<strong>INVOICING</strong>",
            _paragraph(
                f"Payment shall be invoiced {payment_terms.lower()}, with invoices sent at the end "
                f"of each billing cycle for the cost of such billing cycle."
            ),
        ),
        "",
        "<table style='width: 100%; border-collapse: collapse; margin-top: 2rem;'>",
        "<colgroup><col style='width: 50%' /><col style='width: 50%' /></colgroup>",
        "<thead>",
        "<tr>",
        "<th style='border: 1px solid #000; padding: 1rem; text-align: left;'>",
        "________________________________<br />",
        "<strong>Very Big Things, LLC<br /></strong>Date:",
        "</th>",
        "<th style='border: 1px solid #000; padding: 1rem; text-align: left;'>",
        "________________________________<br />",
        f"<strong>{escape(counterparty)}<br /></strong>Date:",
        "</th>",
        "</tr>",
        "</thead>",
        "<tbody></tbody>",
        "</table>",
    ]
    return "".join(body)


def create_contract_agreement(
    agreement_type: str,
    counterparty: str,
    content: str,
    linked_estimate_id: Optional[str] = None,
):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Supabase credentials missing")
    payload = {
        "type": agreement_type,
        "counterparty": counterparty,
        "content": content,
        "linked_estimate_id": linked_estimate_id,
        "current_version": 1,
    }
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/contract_agreements",
        headers=supabase_json_headers("return=representation"),
        json=payload,
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    if not data:
        raise ValueError("Failed to create agreement")
    agreement = data[0]
    insert_contract_version(
        agreement_id=agreement["id"],
        version_number=1,
        content=content,
        notes="Initial version drafted by Copilot",
    )
    return agreement


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


@tool
def apply_proposals(agreement_id: str, proposal_ids: str, notes: str = ""):
    """
    Apply selected review proposals to an agreement and create a new version.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return {"error": "Supabase credentials missing"}
    proposal_id_list = [
        proposal_id.strip()
        for proposal_id in (proposal_ids or "").split(",")
        if proposal_id.strip()
    ]
    print(f"[Copilot][apply_proposals] agreement_id={agreement_id}, proposal_ids={proposal_id_list}")
    if not proposal_id_list:
        return {"error": "Provide at least one proposal_id to apply."}

    agreement = fetch_agreement_record(agreement_id)
    if not agreement:
        return {"error": f"Agreement {agreement_id} was not found."}

    draft_content = fetch_latest_review_draft_content(agreement_id)
    proposals = generate_review_proposals_from_content(draft_content or agreement.get("content"))
    if not proposals:
        return {"error": "No proposals available. Upload or paste a client draft to generate proposals first."}

    selected = [proposal for proposal in proposals if proposal.get("id") in proposal_id_list]
    if not selected:
        return {
            "error": f"No proposals matched ids {proposal_id_list}. Run `review draft` again to refresh proposals.",
        }

    current_content = agreement.get("content") or ""
    updated_content, applied, appended = apply_proposals_to_content(current_content, selected)
    next_version_number = get_next_version_number(agreement_id, agreement.get("current_version"))
    version_notes = notes or f"Applied {len(selected)} proposal(s) via Copilot."

    try:
        insert_contract_version(
            agreement_id=agreement_id,
            version_number=next_version_number,
            content=updated_content,
            notes=version_notes,
        )
        update_contract_agreement_content(
            agreement_id=agreement_id,
            content=updated_content,
            current_version=next_version_number,
        )
        add_system_note(
            agreement_id,
            f"Copilot applied proposals {', '.join(proposal_id_list)}.",
        )
    except Exception as exc:
        return {"error": f"Unable to apply proposals: {exc}"}

    return {
        "message": f"Applied proposals {', '.join(proposal_id_list)}. New version {next_version_number} created.",
        "agreement_id": agreement_id,
        "new_version": next_version_number,
        "applied": applied,
        "appended": appended,
    }


@tool
def create_agreements_from_estimate(estimate_id: str, counterparty: str = ""):
    """
    Generate an MSA and SOW from an approved estimate, linking the SOW back to the estimate.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return {"error": "Supabase credentials missing"}

    if not estimate_id:
        print("[Copilot][create_agreements_from_estimate] Missing estimate_id in tool call.")
        return {
            "error": "No estimate_id provided. Open an estimate detail page (URL /estimates/<id>) before requesting agreement generation, or pass the ID explicitly."
        }

    print(f"[Copilot][create_agreements_from_estimate] estimate_id={estimate_id}, counterparty={counterparty}")
    estimate = fetch_estimate_summary(estimate_id)
    if not estimate:
        print(f"[Copilot] Supabase returned no estimate for {estimate_id}")
        return {"error": f"Estimate {estimate_id} not found."}

    wbs_rows = fetch_wbs_rows(estimate_id)
    if not wbs_rows:
        print(f"[Copilot] No WBS rows for estimate {estimate_id}")
        return {
            "error": "No WBS rows found for this estimate. Approve the Effort Estimate stage before drafting agreements.",
        }

    quote_summary = get_project_total(estimate_id)
    if not quote_summary or quote_summary.get("total_cost", 0) == 0:
        print(f"[Copilot] Quote summary missing for estimate {estimate_id}")
        return {
            "error": "Quote data missing. Fill out the Quote stage (rates, payment terms, delivery timeline) before drafting agreements.",
        }

    business_case = fetch_business_case_content(estimate_id)
    requirements_highlights = extract_requirement_highlights(fetch_requirements_content(estimate_id))
    counterparty_name = counterparty or estimate.get("owner") or f"{estimate.get('name')} Client"

    msa_content = build_msa_content(
        estimate,
        business_case,
        requirements_highlights,
        quote_summary,
        counterparty_name,
    )
    sow_content = build_sow_content(
        estimate,
        wbs_rows,
        quote_summary,
        counterparty_name,
    )

    try:
        msa = create_contract_agreement(
            agreement_type="MSA",
            counterparty=counterparty_name,
            content=msa_content,
        )
        sow = create_contract_agreement(
            agreement_type="SOW",
            counterparty=counterparty_name,
            content=sow_content,
            linked_estimate_id=estimate_id,
        )
    except Exception as exc:
        return {"error": f"Unable to create agreements: {exc}"}

    return {
        "message": f"Created MSA ({msa['id']}) and SOW ({sow['id']}) for {counterparty_name}.",
        "msa_id": msa["id"],
        "sow_id": sow["id"],
        "linked_estimate_id": estimate_id,
    }


backend_tools = [
    summarize_business_case,
    summarize_requirements,
    generate_wbs,
    get_project_total,
    load_exemplar_contracts,
    summarize_pushbacks,
    add_agreement_note,
    apply_proposals,
    create_agreements_from_estimate,
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
        if entity_id:
            context_parts.append(f"Use estimate_id={entity_id} for any tool parameters that require the current estimate.")
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


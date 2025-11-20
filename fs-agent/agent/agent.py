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


def _section(title: str, body: str) -> str:
    return f"<h2>{escape(title)}</h2>{body}"


def _paragraph(text: str) -> str:
    return f"<p>{escape(text)}</p>"


def build_msa_content(
    estimate: Dict[str, Any],
    business_case: str,
    requirements_highlights: List[str],
    quote_summary: Dict[str, Any],
    counterparty: str,
) -> str:
    objectives = business_case.strip() or "Business objectives pending."
    highlights = requirements_highlights or ["Requirements summary pending approval."]
    total_cost = quote_summary.get("total_cost", 0)
    currency = quote_summary.get("currency", "USD")
    payment_terms = quote_summary.get("payment_terms") or "Net 30"

    body = [
        f"<h1>Master Services Agreement — {escape(estimate.get('name', 'Project'))}</h1>",
        _paragraph(
            f"<strong>Parties</strong>: VBT (“Provider”) and {escape(counterparty)} (“Client”). "
            f"<strong>Effective Date</strong>: {datetime.utcnow().date().isoformat()}"
        ),
        _section(
            "1. Engagement Overview",
            _html_list(
                [
                    f"Project: {estimate.get('name', 'Unnamed Project')}",
                    f"Stage: {estimate.get('stage', 'Draft')}",
                    f"Summary: {objectives[:400]}",
                ]
            ),
        ),
        _section("2. Requirements Snapshot", _html_list(highlights[:5])),
        _section(
            "3. Commercial Terms",
            _html_list(
                [
                    f"Estimated Total: {currency} {total_cost}",
                    f"Payment Terms: {payment_terms}",
                    "Rate Card: Refer to Quote stage details.",
                ]
            ),
        ),
        _section(
            "4. Change Management",
            _paragraph(
                "Any change to scope requires a written change request with updated fees and schedule."
            ),
        ),
        _section(
            "5. Intellectual Property",
            _paragraph(
                "Client retains ownership of their IP. VBT retains reusable components and methodologies."
            ),
        ),
        _section(
            "6. Termination",
            _paragraph("Either party may terminate with 60 days written notice. Earned fees remain payable."),
        ),
    ]
    return "".join(body)


def build_sow_content(
    estimate: Dict[str, Any],
    wbs_rows,
    quote_summary: Dict[str, Any],
    counterparty: str,
) -> str:
    total_hours = quote_summary.get("total_hours", 0)
    currency = quote_summary.get("currency", "USD")
    total_cost = quote_summary.get("total_cost", 0)
    payment_terms = quote_summary.get("payment_terms") or "Net 30"
    delivery_timeline = quote_summary.get("delivery_timeline") or "Delivery within 8 weeks"

    wbs_list = (
        "<ul>"
        + "".join(
            f"<li>{escape(row.get('task_code') or '')}: {escape(row.get('description') or '')} "
            f"({row.get('hours')}h, {escape(row.get('role') or '')})</li>"
            for row in wbs_rows[:8]
        )
        + "</ul>"
        if wbs_rows
        else _paragraph("WBS will be finalized after estimate approval.")
    )

    body = [
        f"<h1>Statement of Work — {escape(estimate.get('name', 'Project'))}</h1>",
        _paragraph(f"<strong>Client</strong>: {escape(counterparty)} | <strong>Stage</strong>: {escape(estimate.get('stage', 'Draft'))}"),
        _section(
            "1. Scope Summary",
            _html_list(
                [
                    f"Total Hours: {total_hours}",
                    f"Total Investment: {currency} {total_cost}",
                    f"Payment Terms: {payment_terms}",
                    f"Delivery Timeline: {delivery_timeline}",
                ]
            ),
        ),
        _section("2. Work Breakdown Structure", wbs_list),
        _section(
            "3. Assumptions",
            _html_list(
                [
                    "Client stakeholders available for workshops.",
                    "Existing systems provide required APIs.",
                    "Third-party costs billed as incurred.",
                ]
            ),
        ),
        _section(
            "4. Acceptance",
            _paragraph("Deliverables accepted upon completion of defined scope and walkthrough with stakeholders."),
        ),
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

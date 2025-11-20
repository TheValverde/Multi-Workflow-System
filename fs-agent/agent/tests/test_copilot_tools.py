import os
import uuid
from pathlib import Path
import importlib.util
import pytest
import requests

AGENT_PATH = Path(__file__).resolve().parents[1] / "agent.py"
spec = importlib.util.spec_from_file_location("copilot_agent", AGENT_PATH)
agent_module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(agent_module)  # type: ignore[arg-type]

apply_proposals_to_content = agent_module.apply_proposals_to_content
build_msa_content = agent_module.build_msa_content
build_sow_content = agent_module.build_sow_content
generate_review_proposals_from_content = (
    agent_module.generate_review_proposals_from_content
)
create_agreements_from_estimate = agent_module.create_agreements_from_estimate.func
apply_proposals_tool = agent_module.apply_proposals.func

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")


def ensure_supabase_env():
    global SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        return

    env_file = Path(__file__).resolve().parents[2] / ".env.local"
    if env_file.exists():
        with env_file.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        agent_module.SUPABASE_URL = SUPABASE_URL
        agent_module.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY


def require_supabase():
    ensure_supabase_env()
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        pytest.fail("Supabase credentials not configured; set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY")


def supabase_headers():
    ensure_supabase_env()
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def delete_agreement_tree(agreement_id: str):
    ensure_supabase_env()
    for table in ("contract_versions", "contract_notes"):
        requests.delete(
            f"{SUPABASE_URL}/rest/v1/{table}",
            params={"agreement_id": f"eq.{agreement_id}"},
            headers=supabase_headers(),
            timeout=10,
        )
    requests.delete(
        f"{SUPABASE_URL}/rest/v1/contract_agreements",
        params={"id": f"eq.{agreement_id}"},
        headers=supabase_headers(),
        timeout=10,
    )


def test_generate_review_proposals_from_content_detects_standard_policy_gaps():
    content = """
    Payment terms: Net 60.
    Client may terminate with 30 days notice.
    """

    proposals = generate_review_proposals_from_content(content)
    proposal_ids = {proposal["id"] for proposal in proposals}

    assert "prop-1" in proposal_ids  # Net 60 -> Net 30
    assert "prop-2" in proposal_ids  # 30 day termination -> 60 day
    assert (
        "prop-3" in proposal_ids or "prop-4" in proposal_ids
    ), "Should always include change-order/IP proposal"


def test_apply_proposals_to_content_replaces_and_appends_copy():
    current_content = "Payment terms: Net 60."
    proposals = [
        {
            "id": "prop-1",
            "before": "Payment terms: Net 60",
            "after": "Payment terms: Net 30",
        },
        {
            "id": "prop-2",
            "before": "Non-existent text",
            "after": "Any scope change requires a formal change order.",
        },
    ]

    updated, applied, appended = apply_proposals_to_content(current_content, proposals)

    assert "Net 30" in updated
    assert "change order" in updated  # appended because text was not found
    assert "prop-1" in applied
    assert "prop-2" in appended


def test_build_msa_content_includes_core_sections():
    estimate = {"id": "est-1", "name": "Apollo", "stage": "Quote"}
    business_case = "Drive adoption across EMEA."
    highlights = ["Self-service analytics", "PII redaction pipeline"]
    quote = {"currency": "USD", "total_cost": 120000, "payment_terms": "Net 30"}

    msa = build_msa_content(estimate, business_case, highlights, quote, "Acme Corp")

    assert "<h1>Master Services Agreement" in msa
    assert "<li>Project: Apollo</li>" in msa
    assert "Self-service analytics" in msa
    assert "USD 120000" in msa


def test_build_sow_content_lists_wbs_rows_and_totals():
    estimate = {"id": "est-1", "name": "Apollo", "stage": "Quote"}
    wbs_rows = [
        {"task_code": "DISC-101", "description": "Workshops", "hours": 12, "role": "Lead"},
        {"task_code": "ENG-210", "description": "Implementation", "hours": 80, "role": "Engineer"},
    ]
    quote = {
        "currency": "USD",
        "total_cost": 95000,
        "total_hours": 92,
        "payment_terms": "Net 30",
        "delivery_timeline": "Delivery within 8 weeks",
    }

    sow = build_sow_content(estimate, wbs_rows, quote, "Acme Corp")

    assert "<h1>Statement of Work" in sow
    assert "DISC-101" in sow
    assert "Implementation" in sow
    assert "USD 95000" in sow
    assert "Delivery within 8 weeks" in sow


def test_create_agreements_requires_estimate_id():
    require_supabase()
    result = create_agreements_from_estimate("", "Client")
    assert "error" in result
    assert "No estimate_id provided" in result["error"]


def test_create_agreements_handles_missing_estimate(monkeypatch):
    require_supabase()
    monkeypatch.setattr(agent_module, "fetch_estimate_summary", lambda _id: None)
    result = create_agreements_from_estimate("est-404", "Client")
    assert result["error"] == "Estimate est-404 not found."


def test_create_agreements_success_path():
    require_supabase()
    estimate_id = os.environ.get(
        "TEST_ESTIMATE_ID", "bee360e8-2376-4846-a3a1-1f74650324dd"
    )
    counterparty = f"Copilot QA {uuid.uuid4()}"
    result = create_agreements_from_estimate(estimate_id, counterparty)

    assert "msa_id" in result
    assert "sow_id" in result

    try:
        for agreement_id in (result["msa_id"], result["sow_id"]):
            res = requests.get(
                f"{SUPABASE_URL}/rest/v1/contract_agreements",
                params={"id": f"eq.{agreement_id}"},
                headers=supabase_headers(),
                timeout=10,
            )
            res.raise_for_status()
            data = res.json()
            assert data and data[0]["counterparty"] == counterparty
    finally:
        delete_agreement_tree(result["msa_id"])
        delete_agreement_tree(result["sow_id"])


def test_apply_proposals_requires_ids():
    require_supabase()
    agreement = agent_module.create_contract_agreement(
        agreement_type="SOW",
        counterparty=f"Copilot QA {uuid.uuid4()}",
        content="Payment terms: Net 60",
    )
    try:
        result = apply_proposals_tool(agreement["id"], "", "")
        assert "Provide at least one proposal_id" in result["error"]
    finally:
        delete_agreement_tree(agreement["id"])


def test_apply_proposals_success():
    require_supabase()
    agreement = agent_module.create_contract_agreement(
        agreement_type="SOW",
        counterparty=f"Copilot QA {uuid.uuid4()}",
        content="Payment terms: Net 60. Client may terminate with 30 days notice.",
    )

    try:
        result = apply_proposals_tool(agreement["id"], "prop-1, prop-2", "QA Auto apply")
        assert "new_version" in result

        res = requests.get(
            f"{SUPABASE_URL}/rest/v1/contract_versions",
            params={
                "agreement_id": f"eq.{agreement['id']}",
                "order": "version_number.desc",
                "limit": "1",
            },
            headers=supabase_headers(),
            timeout=10,
        )
        res.raise_for_status()
        latest_version = res.json()[0]
        assert latest_version["version_number"] >= 2
        assert "Net 30" in latest_version["content"]
    finally:
        delete_agreement_tree(agreement["id"])



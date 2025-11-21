# Testing

> **Goal**: Demonstrate how to run tests; include tests for at least 3 key server functions (e.g., proposal application, copilot action, estimate generation).

## Overview

This project includes comprehensive test coverage for both frontend (TypeScript/Vitest) and backend (Python/pytest) components. The test suite validates core business logic including estimate generation, contract proposal application, and Copilot action execution.

## Test Structure

```
fs-agent/
├── src/lib/__tests__/          # Frontend unit tests (Vitest)
│   ├── contractValidation.test.ts
│   ├── contracts.test.ts
│   ├── policies.test.ts
│   └── stageEstimate.test.ts
├── agent/tests/                 # Backend integration tests (pytest)
│   └── test_copilot_tools.py
└── vitest.config.ts             # Vitest configuration
```

## Running Tests

### Frontend Tests (Vitest)

Frontend tests use **Vitest** and cover TypeScript utility functions and business logic.

```bash
cd fs-agent

# Run all frontend tests
pnpm test

# Run tests in watch mode (for development)
pnpm test --watch

# Run specific test file
pnpm test stageEstimate
```

**Test Files:**
- `contractValidation.test.ts` - SOW validation against estimates
- `contracts.test.ts` - Contract proposal application logic
- `policies.test.ts` - Policy tag normalization utilities
- `stageEstimate.test.ts` - Estimate generation, WBS creation, and quote export

### Backend Tests (pytest)

Backend tests use **pytest** and test the LangGraph agent's Copilot tools with real Supabase integration.

```bash
cd fs-agent/agent

# Activate virtual environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Run all backend tests
uv run pytest tests/

# Run with verbose output
uv run pytest tests/ -v

# Run specific test file
uv run pytest tests/test_copilot_tools.py

# Run specific test function
uv run pytest tests/test_copilot_tools.py::test_apply_proposals_success
```

**Prerequisites for Backend Tests:**
- Supabase credentials must be configured in `.env.local` or environment variables:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Tests create and clean up real database records (use a test database if possible)

### Running Tests in Docker

```bash
# Frontend tests
docker compose exec frontend pnpm test

# Backend tests (requires agent container with venv)
docker compose exec agent .venv/bin/python -m pytest tests/
```

## Test Coverage

### 1. Estimate Generation (`stageEstimate.test.ts`)

Tests the core estimate generation and export functionality:

**Functions Tested:**
- `buildStageEstimatePayload()` - Summarizes hours, roles, and costs from WBS
- `generateWbsFromDetail()` - Creates work breakdown structure from project artifacts
- `calculateQuoteTotals()` - Calculates total costs from WBS rows and rates
- `buildQuoteCsv()` - Exports quote data to CSV format

**Test Cases:**
- Summarizes total hours and role breakdowns correctly
- Generates at least 5 WBS tasks referencing artifacts/requirements
- CSV export includes task codes, totals, and payment metadata

**Example:**
```typescript
it("summarizes hours and roles", () => {
  const payload = buildStageEstimatePayload(baseDetail);
  expect(payload.totalHours).toBe(40);
  expect(payload.roleSummary["Backend Engineer"]).toBe(30);
  expect(payload.totalCost).toBeGreaterThan(0);
});
```

### 2. Proposal Application (`contracts.test.ts` + `test_copilot_tools.py`)

Tests contract proposal acceptance and application logic:

**Frontend Tests (`contracts.test.ts`):**
- Applies selected proposals to create new version content
- Handles partial proposal selection correctly
- Validates proposal structure (id, before, after, rationale)

**Backend Tests (`test_copilot_tools.py`):**
- `apply_proposals_to_content()` - Replaces text and appends missing proposals
- `apply_proposals_tool()` - Full integration test creating agreement, applying proposals, verifying new version

**Test Cases:**
- Applies multiple proposals (e.g., "Net 60" → "Net 30", termination period changes)
- Handles proposals where "before" text is not found (appends to content)
- Validates proposal IDs are required
- Verifies new contract version is created with correct content

**Example:**
```python
def test_apply_proposals_success():
    agreement = create_contract_agreement(...)
    result = apply_proposals_tool(agreement["id"], "prop-1, prop-2", "QA Auto apply")
    assert "new_version" in result
    # Verifies version_number >= 2 and content contains "Net 30"
```

### 3. Copilot Actions (`test_copilot_tools.py`)

Tests LangGraph agent tools that power CopilotKit actions:

**Functions Tested:**
- `generate_review_proposals_from_content()` - Detects policy gaps in client drafts
- `build_msa_content()` - Generates Master Services Agreement from estimate data
- `build_sow_content()` - Generates Statement of Work with WBS rows and totals
- `create_agreements_from_estimate()` - Creates MSA and SOW from completed estimate
- `apply_proposals_tool()` - Applies review proposals to create new agreement version

**Test Cases:**
- Proposal generation detects standard policy gaps (payment terms, termination periods)
- MSA generation includes core sections (project name, highlights, quote totals)
- SOW generation lists WBS rows and includes delivery timeline
- Agreement creation from estimate requires valid estimate ID and WBS data
- Proposal application creates new version with updated content

**Example:**
```python
def test_create_agreements_success_path():
    estimate_id = "bee360e8-2376-4846-a3a1-1f74650324dd"
    result = create_agreements_from_estimate(estimate_id, "Test Client")
    assert "msa_id" in result
    assert "sow_id" in result
    # Verifies agreements exist in database with correct counterparty
```

### 4. Contract Validation (`contractValidation.test.ts`)

Tests SOW validation against estimate data:

**Test Cases:**
- Detects payment terms mismatch (e.g., SOW says "Net 45" but estimate requires "Net 30")
- Passes validation when payment terms match
- Detects missing payment terms when estimate requires them
- Categorizes discrepancies by severity (error vs warning)

**Example:**
```typescript
it("detects payment terms mismatch", () => {
  const sowContent = "Payment terms: Net 45.";
  const estimateData = { paymentTerms: "Net 30", ... };
  const discrepancies = validateContract(sowContent, estimateData);
  expect(discrepancies[0].category).toBe("payment_terms");
  expect(discrepancies[0].severity).toBe("error");
});
```

### 5. Policy Utilities (`policies.test.ts`)

Tests policy tag normalization:

**Test Cases:**
- Handles undefined input gracefully
- Splits comma-delimited tag strings
- Deduplicates array entries

## Key Server Functions Tested

### 1. Proposal Application
- **Location**: `contracts.test.ts`, `test_copilot_tools.py`
- **Coverage**: Frontend logic + backend integration
- **Validates**: Proposal selection, content replacement, version creation

### 2. Copilot Action Execution
- **Location**: `test_copilot_tools.py`
- **Coverage**: Full LangGraph agent tool integration
- **Validates**: Agreement creation, proposal generation, content building

### 3. Estimate Generation
- **Location**: `stageEstimate.test.ts`
- **Coverage**: WBS generation, quote calculation, CSV export
- **Validates**: Hours calculation, role summaries, export formatting

## Test Data

### Frontend Tests
- Use mock data structures defined in test files
- No external dependencies required
- Fast execution (< 1 second)

### Backend Tests
- Require Supabase connection
- Create real database records (cleaned up after tests)
- Use test estimate ID: `bee360e8-2376-4846-a3a1-1f74650324dd` (or set `TEST_ESTIMATE_ID` env var)
- Generate unique counterparty names using UUIDs to avoid conflicts

## Continuous Integration

To run all tests in CI:

```bash
# Frontend
cd fs-agent
pnpm install
pnpm test

# Backend
cd fs-agent/agent
uv venv
source .venv/bin/activate
uv pip sync requirements.txt
uv run pytest tests/ -v
```

## Writing New Tests

### Frontend Test Template

```typescript
import { describe, expect, it } from "vitest";
import { yourFunction } from "@/lib/your-module";

describe("yourFunction", () => {
  it("should handle expected case", () => {
    const result = yourFunction(input);
    expect(result).toBe(expected);
  });
});
```

### Backend Test Template

```python
import pytest
from agent import your_function

def test_your_function_success():
    result = your_function(input_data)
    assert "expected_key" in result
    assert result["expected_key"] == expected_value
```

## Troubleshooting

**Frontend tests fail:**
- Ensure dependencies are installed: `pnpm install`
- Check TypeScript compilation: `pnpm build`

**Backend tests fail:**
- Verify Supabase credentials in `.env.local` or environment
- Check network connectivity to Supabase
- Ensure test database has required tables (run migrations)
- Review test cleanup - some tests may leave orphaned records if they fail mid-execution

**Tests timeout:**
- Backend tests make real API calls - ensure Supabase is accessible
- Increase timeout in `pytest.ini` if needed

---

## Summary

The test suite provides comprehensive coverage of:
- **Estimate generation** (WBS, quotes, CSV export)
- **Proposal application** (frontend + backend integration)
- **Copilot actions** (agreement creation, proposal generation)
- **Contract validation** (SOW vs estimate alignment)
- **Policy utilities** (tag normalization)

All tests can be run with simple commands and validate both unit-level logic and integration with Supabase.

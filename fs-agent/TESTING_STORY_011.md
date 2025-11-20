# Testing Guide: STORY-011 — Contracts Copilot Actions

## Prerequisites
- Supabase env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) configured
- At least one agreement with a recent review draft (so proposals exist)
- At least one estimate progressed through the Quote stage

## 1. Apply Proposals Tool
1. Navigate to `/contracts/[sow-id]/review` and upload/paste a client draft that contains “Net 60” and termination language.
2. Click **Review Draft** to generate proposals (IDs `prop-1`, `prop-2`, `prop-3`).
3. Open Copilot and run: `Apply proposals prop-1, prop-2`.
4. Expected:
   - Copilot responds with confirmation referencing the new version number.
   - `contract_versions` table shows a new row with incremented `version_number`.
   - Agreement detail screen refreshes automatically (shared state watcher) showing the latest version selected.
   - Notes panel contains “Copilot applied proposals …” entry.

### Error handling checks
- Ask Copilot to apply proposals before generating a draft → Response explains a draft is required.
- Provide an unknown ID (`prop-9`) → Response lists unmatched IDs.

## 2. Create Agreements from Estimate Tool
1. Choose an estimate that has:
   - Approved WBS rows (Effort Estimate stage complete).
   - Quote stage data (rates, payment terms, delivery timeline).
2. In Copilot run: `Create agreements from estimate <estimate-id> for Contoso`.
3. Expected:
   - Copilot responds within ~60s listing new MSA and SOW IDs.
   - `/contracts` list shows two new agreements for the counterparty.
   - SOW detail sidebar indicates it is linked to the estimate.
   - `contract_versions` table contains initial versions for both agreements.

### Error handling checks
- Run command against estimate without WBS → Response instructs finishing Effort Estimate first.
- Run command without Quote data → Response instructs completing Quote stage.

## 3. Notes & Timeline Sync
- After Copilot actions, open agreement detail and confirm:
  - Version list increments without manual refresh.
  - Notes panel shows Copilot-authored entry.

## 4. Logging & Observability
- Agent logs (`pnpm dev` console) show tool invocation details and remediation hints.
- `AI_ARTIFACTS.md` captures apply/create commands per STORY-010 logging hook.

## 5. Regression: Manual Review Screen
- Select proposals via the UI **Apply Selected** button.
- New version still created (existing flow unaffected).
- Copilot shared state stays aligned because the detail view writes `selected_agreement_version` on save.

## 6. Automated Tests
- Run the Python unit tests that cover Copilot tool helpers:
  ```bash
  cd /home/hugo/jobapps/vbt/REPO/fs-agent/agent
  uv run pytest
  ```
- Tests exercise proposal generation, proposal application, and contract drafting helpers used by STORY-011.
{
  "cells": [],
  "metadata": {
    "language_info": {
      "name": "python"
    }
  },
  "nbformat": 4,
  "nbformat_minor": 2
}
# Contracts Workflow Feature

## Purpose (from RULES.md)
Create and review contracts using LLM guided by policies, track versions/notes, and show concise before/after change proposals.

## Policy Setup (do this first)
- Add Policy Rules
- Add Example Agreements (MSA, SOW, NDA, etc.)
- Use RAW_TEXT directory for exemplar contracts

## Contract Capabilities

### 1. Create New Agreement
- Choose type (MSA or SOW) + counterparty
- System feeds Policy Rules + Example Agreements to LLM
- Save as Agreement v1

### 2. Review Client Draft
- Upload/paste client's agreement → save as incoming v1
- Run policy-based review
- LLM returns material change proposals based on policies
- Each proposal shows exact before → after text + rationale
- Apply selected changes to create new version

### 3. Validate Against Estimate
- Link SOW to an estimate to check alignment
- Agent validates against WBS (tasks, roles, hours) and quote (rates, totals, terms)
- Returns discrepancies (e.g., missing WBS tasks, payment mismatch)

### 4. Version Management
- Add new versions and notes
- View timeline of all changes

## Must-have Screens (from RULES.md)

### Policy Management
- List of policy rules and example agreements
- Add/edit/delete functionality

### Agreements List
- Show all agreements with type (MSA/SOW/NDA), counterparty, current version number

### Agreement Detail
- Current agreement text
- Version selector/timeline on side
- Linked estimate indicator if applicable

### Review Screen
- Side-by-side view showing proposed changes with before/after text
- Checkboxes to accept/reject each change

## Copilot Integration
Commands are context-aware. All edits after LLM generation performed via agent.

**Example commands from RULES.md:**
- "Summarize pushbacks on this agreement"
- "Add a note: 'Net 45 acceptable with 2% discount'"
- "Apply the payment-terms proposals and create a new version"

## Cross-Workflow Example
"Create a new MSA and SOW for Project Apollo; use the scope and estimate from the Estimates workflow"
- Fetches project's artifacts/estimate
- Feeds them into Contracts LLM prompt
- Drafts appropriate agreements

## Optional Bonuses (not required)
- Redline/diff preview (+5 points)
- DOCX/PDF generation (+5 points)
- "Send for signature" mock (+5 points)

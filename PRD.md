# Multi-Workflow System — Product Requirements

## Overview
- **Objective**: Ship a demoable web app that unifies Estimates, Contracts, and a Copilot assisting both workflows within 10 minutes of local setup.
- **Success Metrics**
  - Complete six-stage Estimates workflow with validations and history.
  - Contracts workflow covering policy setup, agreement creation, review, versioning, and estimate validation.
  - Copilot supports ≥6 contextual actions plus cross-workflow orchestration (e.g., draft MSA/SOW from estimate).
  - Tests exist for ≥3 key server functions; project is fully dockerized and document-complete per RULES.md.

## Functional Requirements
### Dashboard
- Two cards (Estimates, Contracts) showing count + last updated timestamp.
- Each card links to its workflow list page.

### Estimates Workflow
1. **Projects List**
   - Filters by stage; each project shows name, current stage pill, last updated, owner.
2. **Project Detail**
   - Stage stepper across six stages with completion state.
   - Current stage panel honoring entry criteria, editable content, approval controls.
   - Timeline showing transitions with timestamp, actor, notes.
3. **Stages & Gates**
   - Artifacts: create project, upload ≥2 artifacts before advancing.
   - Business Case: LLM-generated summary editable via agent; require approval.
   - Requirements: LLM-generated requirements; validation gate.
   - Solution/Architecture: manual/LLM content, approval required.
   - Effort Estimate: LLM WBS with tasks, roles, hours, assumptions; approvals logged.
   - Quote: rate application, payment terms, timeline, CSV export or copy; mark delivered.
4. **Copilot Hooks**
   - Examples: increase backend hours 10%, add QA line item, fetch project total.

### Contracts Workflow
1. **Policy Management**
   - CRUD for policy rules and example agreements (MSA, SOW, NDA, etc.).
2. **Agreements List**
   - Shows type, counterparty, current version number, linked estimate indicator.
3. **Agreement Detail**
   - Display active text, version selector/timeline, linked estimate info.
4. **Agreement Creation**
   - Choose type + counterparty; system feeds policy + exemplars to LLM; saved as v1.
5. **Review Client Draft**
   - Upload/paste draft; run policy-based review returning proposals with before/after text plus rationale.
   - Accept/reject proposals; accepted ones apply to produce new version.
6. **Estimate Validation**
   - Link SOW to estimate; validate against WBS + quote to highlight discrepancies.
7. **Review Screen**
   - Side-by-side view; optional redline enhancement considered bonus.
8. **Copilot Hooks**
   - Examples: summarize pushbacks, add notes, apply payment-term proposals, create new versions.

### Copilot (Global)
- Right-side panel aware of current entity (project/agreement).
- Executes stage-specific actions, updates UI state live.
- Cross-workflow actions (e.g., create MSA & SOW using estimate artifacts).
- Error handling surfaced inline with remediation hints.

### Document & Ops Deliverables
- `README.md`: run instructions (incl. Docker + ≤10 min local), seeding steps.
- `AI_ARTIFACTS.md`: prompt logs, refinements, tool usage, fixups, IDE note.
- `APPROACH.md`: AI tools used, prompt strategy, biggest pivot, future work.
- `TESTING.md`: how to run tests, detail ≥3 server test cases.
- `.env.example`: placeholder keys (OpenAI, Anthropic, etc.).
- Loom demo ≤15 min covering workflows + complex AI prompt.

## Non-Functional Requirements
- Persistence via DB or files; seeds for demo data.
- Dockerized services with ≤10 minute local setup.
- Automated tests covering ≥3 key server functions (proposal application, copilot action execution, estimate generation logic).

## Key User Flows

```mermaid
%% High contrast styling
flowchart LR
    classDef primary fill:#0B1F3A,color:#F5F5F5,stroke:#00D1FF,stroke-width:2px;
    classDef accent fill:#14A38B,color:#0B1F3A,stroke:#F5F5F5,stroke-width:2px;

    A[Create Project + Artifacts] --> B[Business Case (LLM + Approve)]
    B --> C[Requirements (LLM + Validate)]
    C --> D[Solution/Architecture]
    D --> E[Effort Estimate (LLM WBS)]
    E --> F[Quote & Export]
    F -->|Link| G[Contracts Workflow]
    G --> H[Policy Setup]
    H --> I[Generate MSA/SOW]
    I --> J[Review Client Draft]
    J --> K[Apply Changes + Version Timeline]
    K --> L[Validate vs Estimate]

    class A,B,C,D,E,F,G,H,I,J,K,L primary
    class G,H,I,J,K,L accent
```

## Optional Bonuses
- Redline/diff preview (+5 points)
- DOCX/PDF export or signature mock (+5 points)

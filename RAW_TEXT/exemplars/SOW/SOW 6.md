EXHIBIT A: Very Big Things, LLC. STATEMENT OF WORK

**INTRODUCTION/BACKGROUND**

The following Statement of Work (SOW) shall serve to outline the current
scope of work required for \_\_\_\_\_\_\_\_ ("Client"), involving Very
Big Things, LLC ("VBT") and is made pursuant to the Master Service
Agreement between the parties dated October \_\_\_, 2025 (the "MSA").

**SCOPE**

The Research & Discovery phase establishes the foundation for a
successful project implementation through detailed analysis, planning,
and validation. This R&D phase will focus on evaluating and validating
the application of a hybrid Natural Language (NL) Rules
approach—combining asset-aware semantics with lightweight classifiers—to
reduce false positives in Client’s alerting systems while maintaining
required recall levels. This R&D phase is designed to establish
feasibility, provide validated technical prototypes, and deliver
recommendations for potential production-level implementation.

**Processes & Deliverables:**

- <u>Product Definition</u>: Conduct structured workshops with
  > designated Client stakeholders (analyst SMEs, platform/security
  > representatives, and business sponsors) to refine objectives,
  > confirm baseline keyword rule definitions, and prioritize 1–2 rule
  > families for prototyping. Define acceptance thresholds for precision
  > uplift, recall tolerance, and asset coverage.  
  >   
  > **Deliverables**: Finalized priority rule families and baseline
  > rules, and documented acceptance thresholds.

- <u>Research & Data Analysis</u>: Conduct exploratory data analysis
  > (EDA) within Client’s cloud environment (e.g., SageMaker, EMR, or
  > approved Jupyter notebooks), including schema review, language
  > distribution, and data quality profiling for representative data
  > sources (posts, structured feeds, asset seeds).  
  > *  
  > ***Deliverables**: Jupyter notebooks with EDA findings and a written
  > data profile report summarizing schemas, distributions, missingness,
  > and recommended sampling strategy.

- <u>Asset Definition & Normalization</u>: Develop prototype rules and
  > mappings for asset normalization (domains, brands, executives),
  > including a validation table of example mappings, failure cases, and
  > heuristic adjustments.  
  >   
  > **Deliverables**: Prototype notebook implementing normalization
  > logic and a validation table with representative success/failure
  > cases.

- <u>POC Development</u>: Process: Build a hybrid inference pipeline
  > (embeddings + lightweight classifier) for one to two priority rule
  > families, ensuring provenance tracking and reproducibility of
  > prediction outputs (score, confidence, evidence pointers).  
  >   
  > **Deliverables**: Notebook demonstrating the hybrid NL inference
  > prototype, with sample outputs including score, confidence, and
  > provenance pointers.

- <u>Final Recommendation</u>: Access cost and latency implications and
  > provide a recommendation for MVP implementations.  
  >   
  > **Deliverables**: Cost/latency extrapolation analysis, with
  > estimates of token usage, runtime per item, and scalability
  > constraints.

- <u>Implementation Roadmap</u>: Deliver recommendations for next-phase
  > MVP development, including a roadmap with estimated hours,
  > resources, and SME commitments required for productionization.  
  >   
  > **Deliverables**: Roadmap document with Go/No-Go recommendation,
  > estimated hours and cost, required SME commitments, and proposed MVP
  > timeline.

- <u>Knowledge Transfer</u>: Provide technical documentation (notebooks,
  > runbooks) and hold a handover session to ensure Client’s analysts
  > and engineers understand prototype design, limitations, and future
  > recommendations.  
  >   
  > **Deliverables**: Runbook with IAM role bootstrap instructions,
  > technical documentation of prototype notebooks, and one
  > handover/knowledge transfer session.

**SECURITY & COMPLIANCE**

- All work will be performed solely within Client’s approved
  environments.

- No production data will be transferred outside Client’s cloud.

- Least-privilege IAM roles will be used, with full audit logging.

- Derived models and artifacts remain in Client storage.

**COST & ESTIMATED TIMELINE**

The cost to complete this R&D phase is \$40,000, with an estimated
timeline of 4 weeks for completion from the agreed upon start date.

**DEPOSIT**

A deposit equal to \$12,500, shall be paid within ten (10) business days
of the execution of this SOW. If at any time the Client wishes to
terminate this SOW pursuant to the MSA, the deposit shall be applied
pro-rata to all outstanding time committed by VBT, and the remaining
deposit amount, if any, shall be refunded to the Client. Upon completion
of the work to be performed under this SOW the deposit, at the Client's
discretion, may either be returned to the Client or applied to any
upcoming invoice or future work.

**INVOICING & PAYMENT**

Payment shall be invoiced net 15 days, with invoices sent at the
beginning of each two-week billing cycle for the pro rata cost of such
billing cycle.

<table>
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th>________________________________<br />
<strong>Very Big Things, LLC<br />
</strong>Date:</th>
<th>________________________________<br />
<strong>Client<br />
</strong>Date:</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

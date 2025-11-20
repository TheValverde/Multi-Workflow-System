# STORY-014 — Estimate Workspace Refinement

## Summary
Rebuild the `/estimates/[id]` detail experience so it matches the polish promised in `RULES.md`: stage-centric layout, live status badges, inline Copilot cues, and direct Copilot-driven edits for Business Case / Requirements / Quote without manual “Save” steps.

## Business Value
- Reduces friction when moving through the six-stage flow
- Makes Copilot feel like the primary editing surface (not a secondary helper)
- Clarifies gate requirements, showing exactly why a stage can or cannot advance

## Requirements
1. **Stage-Locked Two-Pane Layout**
   - Left: sticky stage stepper + timeline (shows gate checklist per stage)
   - Right: current stage panel with action buttons pinned to the top
   - Panels beyond the current stage remain read-only with “Locked until …” messaging and a CTA pointing at the prerequisite gate
2. **Stage Panels**
   - Business Case & Requirements use the upcoming multi-view editor (see STORY-015) but remain disabled until:
     - Business Case: ≥2 artifacts uploaded, Copilot auto-save running
     - Requirements: Business Case approved
   - Solution/Architecture panel gains structured fields (approach, stack, risks)
   - Quote panel shows “Ready / Missing rates / Missing payment terms” badges
3. **Inline Gates**
   - Each stage shows “Entry Criteria” and “Ready to Advance” checklist
   - Copilot shared state includes `stage_gates`, so commands like “Advance stage” respond with missing requirements if gates aren’t satisfied
4. **Copilot Hooks**
   - Expose `update_business_case`, `update_requirements`, `update_quote_terms` actions so Copilot can write content directly (auto-save handled by STORY-013/015)
   - Copilot sidebar references the current gate (e.g., “Need 2 artifacts to unlock Business Case”)
5. **Performance & Reliability**
   - Replace the existing `useEffect` refresh loop with SWR/React Query caching so shared state updates no longer trigger full refetch storms
   - Timeline updates stream through shared state without manual refresh

## Acceptance Criteria
- Visiting an estimate shows the new two-pane layout with gate checklists
- Copilot updates (e.g., “Set payment terms to Net 45”) immediately reflect in the Quote panel without manual save
- Advancing-stage modal lists all gate items with green checks/red warnings
- Timeline updates appear instantly (<1 s) when approvals happen

## Dependencies
- STORY-013 (auto-save plumbing)
- STORY-015 (editor multi-view)

## Technical Notes
- Use React Query to cache `/api/estimates/[id]` responses and invalidate on mutations
- Stage gate data can reuse logic from `/api/estimates/[id]` but should be exposed as a dedicated helper (`buildStageGateStatus`)
- Ensure layout scales down to 1280px width without horizontal scroll


# STORY-015 — Dual-Pane Editor & Docked Copilot

## Summary
Replace the current TipTap-only experience with a template-driven dual-pane authoring surface: structured editor on the left (section-based, template-aware), live export preview on the right, Copilot chat permanently docked on the outer rail. Supports agreements, Business Case, and Requirements.

## Business Value
- Writers see exactly what will be exported (no more “raw markdown” confusion)
- Copilot can highlight sections in the preview as it suggests edits
- Keeps Copilot always visible, reinforcing it as the primary assistant

## Requirements
1. **Editor Shell**
   - Left pane: template-aware editor that enforces our professional agreement template (headings, clause numbering, legal boilerplate). Users edit clause content, not raw markdown. (TipTap is acceptable only if extended with custom schema + locked templates; otherwise consider a bespoke section editor.)
   - Section navigator to jump between template regions (e.g., “Payment Terms”, “Termination”, “Scope”).
   - Right pane: Styled preview using the exact export layout (mirrors exemplars).
2. **Copilot Dock**
   - Right edge of the screen hosts a 320px dock with the Copilot chat
   - Dock cannot be closed; only collapsed to 60px when viewport < 1400px
   - Copilot messages can highlight sections of the preview (scroll into view)
3. **Content APIs**
   - All content stored as HTML (no raw markdown). TipTap still edits HTML; export preview consumes same HTML.
   - Existing `/api/...` endpoints updated to read/write `content_html`
4. **Accessibility & Performance**
   - Keyboard shortcut (`Cmd/Ctrl+Shift+P`) toggles preview visibility
   - Preview renders efficiently (no full reflow on every keystroke—use throttled updates tied to auto-save acknowledgment)
5. **Scope**
- Agreements (MSA/SOW) adopt the new template editor first: load the relevant exemplar as the base template, map each editable clause to a structured field.
- Business Case & Requirements reuse a lighter schema (sections for Goals / KPIs / Scope) but still use the same dual-pane component.
- Quote/Solution panels keep layout but integrate the docked Copilot from this story.

## Acceptance Criteria
- Editor shows split view with synchronized scroll (toggleable preview)
- Copilot cannot be closed; collapse button simply narrows the dock
- Preview always matches export styling (colors, fonts, headings same as exemplars)
- Generated agreements default to the professional template (H1 title, clause numbering, consistent fonts). Compare output against the exemplar to ensure parity.
- Switching between stages remembers the last preview visibility preference
- Screen width ≥1280px shows editor + preview + dock without overlap; narrower screens collapse preview automatically

## Dependencies
- STORY-013 (auto-save feed for preview updates)
- STORY-014 (estimate shell consumes this component)

## Technical Notes
- Consider using TipTap’s `ContentMirror` or `ReactDOMServer` to generate preview HTML from the editor JSON.
- Use CSS Grid (editor | preview | dock) for predictable sizing.
- Copilot dock should integrate with global shared state to display the current entity context.


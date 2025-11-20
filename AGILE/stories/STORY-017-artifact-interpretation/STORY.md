# STORY-017 — Artifact Interpretation & Insight Extraction

## Summary
Give the LLMs real visibility into uploaded artifacts by extracting text/vision signals from every file (PNG, JPG, PDF, DOCX, Markdown, plain text) and piping the parsed content into Business Case / Requirements / Effort Estimate generators. Artifacts should no longer be referenced only by filename; Copilot should summarize actual content.

## Business Value
- Dramatically improves the quality of generated Business Case and Requirements drafts.
- Unlocks visual artifact review (wireframes, screenshots) and allows Copilot to quote relevant details.
- Sets the stage for future “cite artifact section X” functionality.

## Requirements
1. **Artifact Processing Pipeline**
   - On upload, asynchronously extract text:
     - Images (PNG/JPG) → use OCR/vision API (OpenAI GPT-4o mini vision or Supabase OCR) to capture text + structured hints.
     - PDF/DOCX/MD/TXT → use server-side parsers to produce normalized Markdown/HTML.
   - Store extracted content in a new `artifact_extracts` table (`artifact_id`, `content_html`, `content_text`, `summary`, `extraction_status`, `extracted_at`).
2. **LLM Integration**
   - `summarize_business_case`, `summarize_requirements`, and `generate_wbs` must pull from `artifact_extracts` (fallback to filename only if extraction failed).
   - Business Case and Requirements generation prompts should feed the actual extracted text so the generated content references specific details from artifacts (e.g., "From Wireframe.png: the header includes a CTA button...").
   - Copilot actions should quote snippets of artifact content, not just list filenames.
3. **UI Surfacing**
   - Artifact list shows extraction status (Pending / Processing / Ready / Failed) with retry option.
   - Hovering an artifact shows a quick preview (first 300 chars or thumbnail for images).
4. **Error Handling**
   - Failed extractions expose a “Retry extraction” button.
   - Copilot mentions if an artifact couldn’t be parsed (“Couldn’t read Wireframe.png — try re-uploading as PDF”).
5. **Performance & Async**
   - Use background jobs (Next API route + queue or Supabase Functions) so uploads return quickly.
   - Business Case/Requirements generation waits until extraction finishes or explicitly tells the user to retry once ready.

## Acceptance Criteria
- Uploading PNG/JPG/PDF/DOCX/MD produces readable text stored in Supabase and visible in the UI preview.
- Generated Business Case / Requirements cite actual artifact content (“From Wireframe.png: ‘Header includes CTA…’”).
- Failed extractions show actionable errors and Copilot guidance.
- Regression tests confirm text extraction pipeline runs for each supported file type.

## Dependencies
- STORY-003 (artifact gate)
- STORY-013 (auto-save ensures text is always current after extraction)

## Technical Notes
- Potential libraries/services: `pytesseract` via LangGraph worker, `pdfplumber`, `docx2python`, `remark` for Markdown.
- Store both raw text (`content_text`) and sanitized HTML (`content_html`) for reuse in preview + LLM prompts.
- Consider cost & latency for vision models; batch small images together when possible.


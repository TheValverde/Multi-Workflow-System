# STORY-017 — Artifact Interpretation & Insight Extraction (MD & DOCX)

## Summary
Give the LLMs real visibility into uploaded Markdown and DOCX artifacts by extracting text content and piping the parsed content into Business Case / Requirements / Effort Estimate generators. Artifacts should no longer be referenced only by filename; Copilot should summarize actual content.

**Scope:** This story focuses exclusively on Markdown (.md) and DOCX (.docx) files. PDF and image extraction will be handled in separate stories.

## Business Value
- Dramatically improves the quality of generated Business Case and Requirements drafts by using actual artifact content.
- Allows Copilot to quote specific details from uploaded documents.
- Sets the stage for future "cite artifact section X" functionality.

## Requirements
1. **Artifact Processing Pipeline**
   - On upload, asynchronously extract text from `.md` and `.docx` files:
     - Markdown files → parse directly to normalized Markdown/HTML.
     - DOCX files → use server-side parser (`mammoth` or `docx`) to extract text and convert to Markdown/HTML.
   - Store extracted content in a new `artifact_extracts` table (`artifact_id`, `content_html`, `content_text`, `summary`, `extraction_status`, `extracted_at`, `error_message`).
   - Extraction runs asynchronously after upload completes (non-blocking).
2. **LLM Integration**
   - `summarize_business_case`, `summarize_requirements`, and `generate_wbs` must pull from `artifact_extracts` (fallback to filename only if extraction failed or not yet processed).
   - Business Case and Requirements generation prompts should feed the actual extracted text so the generated content references specific details from artifacts (e.g., "From requirements.md: 'The system must support user authentication...'").
   - Copilot actions should quote snippets of artifact content, not just list filenames.
3. **UI Surfacing**
   - Artifact list shows extraction status (Pending / Processing / Ready / Failed) with visual indicator.
   - Hovering or clicking an artifact shows a quick preview (first 300 chars of extracted text).
4. **Error Handling**
   - Failed extractions expose a "Retry extraction" button.
   - Copilot mentions if an artifact couldn't be parsed ("Couldn't read document.docx — try re-uploading").
   - Error messages stored in `artifact_extracts.error_message` for debugging.
5. **Performance & Async**
   - Extraction happens in background after upload returns success.
   - Business Case/Requirements generation waits for extraction to complete or shows a message if still processing.

## Acceptance Criteria
- Uploading `.md` or `.docx` files triggers automatic text extraction.
- Extracted text is stored in `artifact_extracts` table with proper status tracking.
- Generated Business Case / Requirements cite actual artifact content ("From requirements.md: 'The system must...'").
- UI shows extraction status for each artifact (Pending/Processing/Ready/Failed).
- Failed extractions show actionable errors and retry option.
- Regression tests confirm text extraction pipeline runs for both MD and DOCX file types.

## Dependencies
- STORY-003 (artifact gate)
- STORY-016 (create estimates)

## Technical Notes
- **Libraries:**
  - Markdown: Use native parsing (or `marked`/`remark` for HTML conversion).
  - DOCX: Use `mammoth` (converts DOCX to HTML) or `docx` (Node.js library) for text extraction.
- Store both raw text (`content_text`) and sanitized HTML (`content_html`) for reuse in preview + LLM prompts.
- Extraction status enum: `pending`, `processing`, `ready`, `failed`.
- Run extraction asynchronously via Next.js API route (or background job) to avoid blocking upload response.


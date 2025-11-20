# STORY-013 — Auto-Save for Agreement Content

## Summary
Implement Google Docs-style auto-save functionality for agreement content editing, eliminating the need for manual "Save Changes" clicks and ensuring validation checks always reflect the latest content.

## Business Value
Improves user experience by removing friction from the editing workflow and prevents validation mismatches caused by unsaved changes. Users can focus on content creation without worrying about manual saves.

## Requirements
- Auto-save agreement content changes after a debounce period (e.g., 2-3 seconds of inactivity)
- Visual indicator showing save status (saving, saved, error)
- Auto-save should trigger on TipTap editor content changes
- Validation endpoint should always use the latest saved content (no need to manually save before validating)
- Handle network errors gracefully with retry logic
- Preserve unsaved changes indicator if user navigates away

## Acceptance Criteria
- Content changes auto-save within 3 seconds of typing stopping
- Save status indicator clearly shows current state (saving/saved/error)
- Validation results reflect the most recently saved content automatically
- No data loss if user navigates away during save
- Works seamlessly with existing version creation workflow

## Dependencies
- STORY-008 (agreement detail UI with TipTap editor)
- STORY-009 (validation workflow)

## Technical Notes
- Use debounced API calls (e.g., `lodash.debounce` or custom hook)
- Consider optimistic updates for better UX
- May need to extend existing `PATCH /api/contracts/:id` endpoint or create dedicated auto-save endpoint
- TipTap editor's `onUpdate` callback should trigger auto-save logic


# STORY-013 — Real-Time Agreement Sync & Auto-Save

## Summary
Replace the manual “Save Changes” workflow on the agreement detail screen with an always-on sync loop that saves every edit (content + metadata) within two seconds, streams status to Copilot, and keeps the validation + version history views aligned with the latest text.

## Business Value
- Eliminates user confusion (“why didn’t validation see my edits?”)
- Enables Copilot to quote the exact text it just helped edit
- Builds trust that the displayed document is always what will be exported

## Requirements
1. **Auto-Save Engine**
   - Debounced (≤1500 ms) save pipeline triggered by TipTap `onUpdate`
   - Uses a dedicated endpoint `PATCH /api/contracts/:id/autosave` that records:
     - `content_html`, `content_text`, `last_auto_saved_at`, `auto_save_version`
   - Retries w/ backoff; surfaces non-recoverable errors in the UI + Copilot stream
2. **Status UX**
   - Inline badge inside the editor header showing “Saving… / Saved / Offline”
   - Disable version creation button while a save is in-flight
   - Toast + Copilot message if saves fail three times in a row
3. **Validation + Review Integration**
   - `/api/contracts/:id/validate` and review POST endpoints must read `content_html` atomically (no stale content)
   - If validation is running during a save, queue the save and run immediately after
4. **Copilot Awareness**
   - Copilot shared state exposes `draft_status` + `last_auto_saved_at`
   - When Copilot injects text (future stories), it reuses the same autosave hook
5. **Navigation Safety**
   - Leaving the page mid-save awaits completion or shows “Finishing save…” modal
   - Hard refresh should never drop edits (pending saves stored in IndexedDB/localStorage until acknowledged by API)

## Acceptance Criteria
- Typing stops → within 2 s the “Saved just now” badge appears and Supabase rows show updated content.
- Validation run immediately after typing always includes the new text.
- Killing the network while typing flips the badge to “Offline – retrying…”, retries 5x, then displays an error + Copilot warning.
- Reloading right after typing restores the latest saved text (no stale content).
- Tests prove that concurrent saves serialize correctly (no lost updates).

## Dependencies
- STORY-008 (agreement editor screen)
- STORY-010 (Copilot global shared state)
- STORY-011 (Copilot actions that mutate agreements)

## Technical Notes
- Build a reusable `useAutoSyncDocument` hook (TipTap plugin + React hook) so we can reuse it for Business Case/Requirements later.
- Supabase table updates need optimistic locking (e.g., compare `auto_save_version`).
- Consider `navigator.sendBeacon` as a fallback when the user closes the tab.


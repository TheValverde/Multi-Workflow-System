# Testing Guide: STORY-010 — Global Copilot Shared State & UI Shell

## What Should Work ✅

### 1. Global Copilot UI Shell
- **Expected**: Copilot sidebar should be visible on ALL pages
- **Test**: Navigate to:
  - `/` (homepage)
  - `/estimates`
  - `/estimates/[any-id]`
  - `/contracts`
  - `/contracts/[any-id]`
  - `/policies`
- **Verify**: Sidebar appears on right side with context-aware title

### 2. Context-Aware Sidebar Titles
- **On `/estimates` or `/estimates/[id]`**: Title should say "Estimates Copilot"
- **On `/contracts` or `/contracts/[id]`**: Title should say "Contracts Copilot"
- **On `/` or other pages**: Title should say "AI Assistant"

### 3. Context-Aware Initial Messages
- **On Estimates pages**: Message mentions business cases, WBS, totals
- **On Contracts pages**: Message mentions pushbacks, notes, proposals
- **On Homepage**: Generic message about both workflows

### 4. Context Synchronization (<250ms)
- **Test**: Navigate from `/estimates` → `/estimates/[id]`
- **Expected**: Copilot context updates immediately (check browser console for `[Copilot] Context updated` logs)
- **Test**: Navigate from `/contracts` → `/contracts/[id]`
- **Expected**: Same rapid context update

### 5. Estimates Workflow Tools (Should Work)
These tools were already implemented and should still work:

#### `summarize_business_case`
- **Command**: "Summarize the business case for this project"
- **Expected**: Returns summary of artifacts for current estimate
- **Where**: On `/estimates/[id]` page

#### `summarize_requirements`
- **Command**: "Summarize the requirements"
- **Expected**: Returns requirements checklist based on artifacts
- **Where**: On `/estimates/[id]` page

#### `generate_wbs`
- **Command**: "Generate a WBS for this project"
- **Expected**: Creates and persists WBS rows in database
- **Where**: On `/estimates/[id]` page (Effort Estimate stage)

#### `get_project_total`
- **Command**: "What's the current total for this project?" or "Calculate the project total"
- **Expected**: Returns total cost, hours, payment terms, delivery timeline
- **Where**: On `/estimates/[id]` page (Quote stage)

#### `load_exemplar_contracts`
- **Command**: "Load MSA exemplars" or "Show me SOW examples"
- **Expected**: Returns list of exemplar contracts from Supabase
- **Where**: Any page

### 6. Contracts Workflow Tools (NEW - Should Work)

#### `summarize_pushbacks`
- **Command**: "Summarize pushbacks on this agreement" or "What are the pushbacks?"
- **Expected**: Returns summary of notes and policy conflicts
- **Where**: On `/contracts/[id]` page
- **Note**: Requires agreement to have notes in database

#### `add_agreement_note`
- **Command**: "Add a note: Net 45 acceptable with 2% discount"
- **Expected**: Note is persisted to Supabase and appears in notes panel
- **Where**: On `/contracts/[id]` page
- **Verify**: Check notes panel on agreement detail page

### 7. Workflow-Aware System Prompt
- **Test**: Ask a generic question on Estimates page vs Contracts page
- **Expected**: Agent responses should reference the appropriate workflow context
- **Example**: 
  - On `/estimates/[id]`: "What can you help me with?" → Should mention WBS, business case, etc.
  - On `/contracts/[id]`: "What can you help me with?" → Should mention pushbacks, notes, proposals

### 8. Logging (Development Mode)
- **Expected**: Browser console shows `[Copilot]` logs when:
  - Context updates on navigation
  - Keyboard shortcuts pressed (Cmd/Ctrl+K)
- **Expected**: Agent logs (if running locally) show:
  - Workflow, entity_id, entity_type
  - System prompt snippets
  - Tool calls

### 9. Keyboard Shortcuts
- **Test**: Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
- **Expected**: Console logs the shortcut (sidebar toggle enhancement pending)

## What Should NOT Work Yet ❌

### 1. Advanced Contracts Tools (STORY-011)
- **`apply_proposals`**: Not implemented yet
  - **Command**: "Apply the payment-terms proposals"
  - **Status**: Will be implemented in STORY-011
  
- **`create_agreements_from_estimate`**: Not implemented yet
  - **Command**: "Create a new MSA and SOW for Project Apollo"
  - **Status**: Will be implemented in STORY-011

### 2. Advanced Estimates Tools (May be in STORY-011)
- **`adjust_hours`**: Not implemented as LangGraph tool yet
  - **Status**: May be frontend action only currently
  
- **`add_line_item`**: Not implemented as LangGraph tool yet
  - **Status**: May be frontend action only currently

### 3. Mobile Drawer
- **Status**: Desktop sidebar works, mobile drawer enhancement pending
- **Current**: CopilotSidebar should still work on mobile, but may not have custom drawer styling

## Step-by-Step Testing Checklist

### Test 1: Basic UI Visibility
1. ✅ Navigate to `/estimates`
2. ✅ Verify sidebar appears on right
3. ✅ Check title says "Estimates Copilot"
4. ✅ Navigate to `/contracts`
5. ✅ Verify title changes to "Contracts Copilot"

### Test 2: Context Synchronization
1. ✅ Go to `/estimates`
2. ✅ Open browser console (F12)
3. ✅ Click on an estimate to go to `/estimates/[id]`
4. ✅ Check console for `[Copilot] Context updated` log
5. ✅ Verify log shows `workflow: "estimates"`, `entity_id: "[id]"`, `entity_type: "project"`

### Test 3: Estimates Tools
1. ✅ Navigate to `/estimates/[id]` (use a real estimate ID)
2. ✅ In copilot, type: "What's the current total for this project?"
3. ✅ Verify response includes cost, hours, payment terms
4. ✅ Type: "Generate a WBS"
5. ✅ Verify WBS rows appear in Effort Estimate panel

### Test 4: Contracts Tools
1. ✅ Navigate to `/contracts/[id]` (use a real agreement ID)
2. ✅ In copilot, type: "Add a note: Testing STORY-010"
3. ✅ Verify note appears in notes panel
4. ✅ Type: "Summarize pushbacks"
5. ✅ Verify summary is returned (may be empty if no notes exist)

### Test 5: Workflow Awareness
1. ✅ On `/estimates/[id]`, ask: "What can you help me with?"
2. ✅ Verify response mentions estimates-specific actions
3. ✅ Navigate to `/contracts/[id]`
4. ✅ Ask same question
5. ✅ Verify response mentions contracts-specific actions

### Test 6: Cross-Workflow Navigation
1. ✅ Start on `/estimates`
2. ✅ Navigate to `/estimates/[id]`
3. ✅ Navigate to `/contracts`
4. ✅ Navigate to `/contracts/[id]`
5. ✅ Verify sidebar title and context update at each step
6. ✅ Check console logs show context updates

## Troubleshooting

### Sidebar Not Visible
- **Check**: Is `GlobalCopilot` component in `layout.tsx`?
- **Check**: Is `CopilotKit` provider wrapping children?
- **Check**: Browser console for errors

### Context Not Updating
- **Check**: Browser console for `[Copilot] Context updated` logs
- **Check**: Network tab for agent state updates
- **Verify**: `useCopilotContext` hook is called in page components

### Tools Not Working
- **Check**: Agent is running (LangGraph server on port 8123)
- **Check**: Environment variables set (LANGGRAPH_DEPLOYMENT_URL)
- **Check**: Browser console for tool call errors
- **Verify**: Tool is in `backend_tools` list in `agent.py`

### Logging Not Appearing
- **Check**: `NODE_ENV === "development"` (frontend logs)
- **Check**: `ENVIRONMENT === "development"` (backend logs)
- **Verify**: Console is open and not filtered

## Expected Console Output (Development)

When navigating from `/estimates` to `/estimates/[id]`:
```
[Copilot] Context updated {
  workflow: "estimates",
  entity_id: "70fc1d39-8d5a-4ec7-9243-0c430436ef96",
  entity_type: "project",
  pathname: "/estimates/70fc1d39-8d5a-4ec7-9243-0c430436ef96"
}
```

When agent processes a tool call:
```
[Copilot] Workflow: estimates, Entity: 70fc1d39-8d5a-4ec7-9243-0c430436ef96, Type: project
[Copilot] System prompt: You are assisting with the Estimates workflow...
[Copilot] Tool calls: ['get_project_total']
```

## Next Steps (STORY-011)

After verifying STORY-010 works, STORY-011 will add:
- `apply_proposals` tool
- `create_agreements_from_estimate` cross-workflow tool
- Enhanced mobile drawer styling
- More advanced tool integrations


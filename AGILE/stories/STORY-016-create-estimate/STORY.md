# STORY-016 — Create New Estimate

## Summary
Enable users to create new estimates from the estimates list page. Provide a clean form interface and API endpoint to initialize new projects in the "Artifacts" stage.

## Business Value
- Users can start new estimation workflows without manual database intervention.
- Streamlines the project initiation process.
- Sets the foundation for the full estimation workflow (STORY-003+).

## Requirements
1. **UI Components**
   - Add a "New Estimate" button on the `/estimates` list page.
   - Create a modal or dedicated page (`/estimates/new`) with a form containing:
     - **Name** (required): Project/estimate name
     - **Owner** (required): Client or counterparty name
     - **Description** (optional): Brief project description
   - Form validation with clear error messages.
   - Loading state during creation.
   - Redirect to the new estimate detail page (`/estimates/[id]`) upon success.

2. **API Endpoint**
   - `POST /api/estimates` endpoint that:
     - Accepts `name`, `owner`, and optional `description` in the request body.
     - Validates required fields.
     - Creates a new row in the `estimates` table with:
       - `id`: UUID (auto-generated)
       - `name`: From form
       - `owner`: From form
       - `stage`: "Artifacts" (initial stage)
       - `description`: Optional field (if supported by schema)
       - `created_at`: Current timestamp
       - `updated_at`: Current timestamp
     - Returns the created estimate record.
     - Handles errors gracefully (duplicate names, database errors, etc.).

3. **Navigation & UX**
   - "New Estimate" button prominently placed on the estimates list.
   - Breadcrumb navigation shows "Estimates > New Estimate".
   - Success message or immediate redirect to detail page.
   - Error handling with user-friendly messages.

4. **Copilot Integration**
   - After creation, sync Copilot context to the new estimate.
   - Copilot should be aware of the new project and ready to assist with artifact uploads.

## Acceptance Criteria
- Users can click "New Estimate" from `/estimates` and see a form.
- Submitting the form with valid data creates a new estimate in Supabase.
- The new estimate appears in the list with stage "Artifacts".
- Redirecting to `/estimates/[id]` shows the project detail page for the new estimate.
- Form validation prevents submission with missing required fields.
- Error messages are clear and actionable.
- The API endpoint returns appropriate HTTP status codes (201 for success, 400 for validation errors, 500 for server errors).

## Dependencies
- STORY-002 (estimates list UI) — must exist to add the "New Estimate" button.
- STORY-003 (stage stepper) — detail page must exist to redirect to.

## Technical Notes
- Follow the same pattern as `/contracts/new` for consistency.
- Use Next.js server actions or API routes for creation.
- Ensure the estimate starts in the "Artifacts" stage (first stage in the workflow).
- Consider adding a "Cancel" button that returns to the estimates list.
- The form should be accessible and keyboard-navigable.


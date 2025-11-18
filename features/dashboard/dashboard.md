# Dashboard Feature

## Purpose
Entry point showing overview of both workflows with quick navigation.

## Requirements from RULES.md
- Two cards: **Estimates** and **Contracts**
- Each card shows:
  - Count of records
  - Last updated timestamp
- Click through to each workflow's list page

## Implementation Notes
- Use Next.js `Link` component for navigation
- Fetch data from API endpoints
- Simple, clean design matching AGUI Shared State styling
- Responsive layout (desktop/mobile)

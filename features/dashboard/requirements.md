# Dashboard Requirements

## Frontend Dependencies
All dependencies already in the AGUI Shared State project:
- `next` - routing and API
- `react` - UI components
- `date-fns` - timestamp formatting

## API Endpoints
```typescript
GET /api/dashboard/metrics
Response: {
  estimates: {
    count: number,
    lastUpdated: string // ISO timestamp
  },
  contracts: {
    count: number,
    lastUpdated: string // ISO timestamp
  }
}
```

## UI Components
- `DashboardCard` - Reusable card component
- Shows count + formatted timestamp ("2 hours ago")
- Links to `/estimates` and `/contracts`

## No additional libraries needed
Reuse existing AGUI Shared State styling and components.

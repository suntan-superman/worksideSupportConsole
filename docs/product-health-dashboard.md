# Product Health Dashboard

Date: 2026-06-28

## Goal

Show operational health for SageSet, Merxus AI, RadiusIQ, and Workside Support Console.

## Client Modules Added

- `src/services/productHealth.js`
- `src/render/productHealthDashboard.js`

## Preferred Endpoint

```http
GET /support/products/health
```

## Row Shape

```json
{
  "id": "sageset",
  "label": "SageSet",
  "status": "healthy",
  "latestRelease": "2026.06.28",
  "readinessScore": 96,
  "qa": "healthy",
  "meta": "healthy",
  "stripe": "healthy",
  "auth": "healthy",
  "email": "healthy",
  "notifications": "warning",
  "latestReportUrl": "/release-archive/SageSet/2026-06-28/release-report.html",
  "updatedAt": "2026-06-28T00:00:00.000Z"
}
```

Unknown data must be shown as `unknown`, not hidden.

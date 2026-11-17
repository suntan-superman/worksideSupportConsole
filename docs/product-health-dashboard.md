# Product Health Dashboard

Date: 2026-11-17

## Goal

Show operational health for SageSet, Merxus AI, RadiusIQ, Route Logistics, and Workside Support Console.

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

## Client behavior

- The catalog contains SageSet (`sageset`), Merxus AI (`merxus`), RadiusIQ (`radiusiq`), Route Logistics (`route-logistics`), and Workside Support Console (`support-console`).
- Missing health rows remain visible as unknown and are identified as missing. Partial, malformed, unauthorized, unavailable, timed out, and stale feeds receive a dashboard warning without blocking support operations.
- A health record is stale after 24 hours without an update timestamp, or when the source explicitly marks it stale. Healthy and warning values without a usable update timestamp are shown as unknown.
- Latest release is loaded from the existing per-product `/support/products/:productId/releases/latest` endpoint, cached for five minutes, and used ahead of the health record's release value. Release data remains visible when health loading fails.
- Report links are restricted to same-origin relative paths and HTTP(S) URLs.

The 24-hour freshness window is a conservative frontend fallback. The backend should expose its authoritative source freshness and source errors so the dashboard can report those directly.

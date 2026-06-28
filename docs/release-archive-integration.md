# Release Archive Integration

Date: 2026-06-28

## Client Modules Added

- `src/services/releaseArchive.js`
- `src/render/releaseArchiveView.js`

## Preferred Endpoints

```http
GET /support/products/:productId/releases/latest
GET /support/products/:productId/releases
GET /support/products/:productId/releases/:releaseId
```

## Release Shape

```json
{
  "id": "2026-06-28",
  "product": "sageset",
  "version": "2026.06.28",
  "date": "2026-06-28",
  "readinessScore": 96,
  "recommendation": "deploy",
  "status": "passed",
  "htmlUrl": "/release-archive/SageSet/2026-06-28/release-report.html",
  "jsonUrl": "/release-archive/SageSet/2026-06-28/release-report.json",
  "pdfUrl": "/release-archive/SageSet/2026-06-28/release-certificate.pdf"
}
```

## Missing Data

Missing archive data should show as `Unknown` or `N/A`.

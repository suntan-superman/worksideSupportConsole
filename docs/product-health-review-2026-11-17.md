# Product Health Completion Review

Date: 2026-11-17

## Confirmed architecture and root cause

- Production API host: `https://api.merxus.ai`.
- Cloud Run service: `merxus-ai-backend`, region `us-central1`.
- Cloud Run domain mapping: `api.merxus.ai` routes to `merxus-ai-backend`.
- Root cause: the support router registered `/support/products` and session routes, but had no Product Health or latest-release routes.
- Authentication uses the existing Firebase ID Bearer token and support-user middleware. New routes use the same middleware and product-scope rules.

## Backend implementation and production release

- `GET /support/products/health` returns the five-product catalog, limited to the authenticated operator's allowed products. When no authoritative health source is configured, overall and category statuses are `unknown`, freshness is `unknown`, and source metadata identifies the unconfigured source. It does not infer health from website responses, environment variables, or deployments.
- `GET /support/products/:productId/releases/latest` is product-scoped. No existing release archive route, source, or matching storage bucket was found. Supported products without a record receive a documented `404 RELEASE_NOT_FOUND`; no release versions are fabricated and no database is created.
- Backend contract documentation: `Merxus/merxus-ai-backend/docs/support-product-health-api.md`.
- Pre-deployment snapshot: `Merxus/merxus-ai-backend/worktree-snapshots/product-health-predeploy-20261117-111819.zip`. It excludes `.env` and `node_modules`.
- Production revision: `merxus-ai-backend-00807-tbk`, image digest `sha256:74068f2c362b5f38e93c4c2036bcc10fed9722d875b01b84bb2b0977ae09bfa6`, receiving 100% of service traffic.
- Rollback revision: `merxus-ai-backend-00805-jjd`, image digest `sha256:0a5dac29185f8a7b56f80ad100ea5237e42fbc801fc08316d1c469379d866cdd`. The existing `rl-assistant-20261117` tagged revision was retained.

## Frontend behavior

- All five products remain visible. Partial, missing, unauthorized, unavailable, malformed, timeout, stale, and unknown-freshness states are distinguishable.
- Stale records are marked after 24 hours without an update timestamp, or when the source explicitly marks them stale. Latest release is read from the existing per-product endpoint and cached for five minutes; it remains Unknown when the backend returns `RELEASE_NOT_FOUND`.
- Route Logistics uses `route-logistics` in the filter and health catalog. The console also filters mismatched results defensively.

## Validation and production verification

- Backend regression tests: 167 passed across 9 files, including support authorization scope, Merxus handoff, transfer state, and Route Logistics knowledge.
- Product Health backend contract tests: 5 passed.
- Support Console tests: 45 passed across 9 files.
- Support Console production build: passed.
- Unauthenticated production requests to the new health and latest-release routes return 401 instead of 404; the existing sessions route also returns 401. This confirms the routes are mounted behind support authentication. No authorized operator token/session was available, so production record contents and CORS behavior were not verified.
- The Support Console production site is `https://support.worksidesoftware.com` and is served by Netlify. Frontend production deployment remains pending: the tested 19-file release set is staged on `main`, but automatic review rejected its commit.

## Remaining Unknown values and follow-up

- No authoritative source adapters were found for QA, Meta, Stripe, Auth, Email, or Notifications. The production dashboard must show Unknown until those sources are connected.
- No release archive source or record store was found. The latest-release endpoint correctly returns a missing-record response.
- The existing backend checkout contained unrelated uncommitted work before this change. No backend files were committed or pushed; the deployment-only policy was followed.

## Additional review item

`npm ci` in the Support Console reported 33 dependency advisories in the full dependency tree (1 critical, 18 high, 13 moderate, and 1 low). This summary was not triaged in this Product Health change; review production-impacting advisories separately.

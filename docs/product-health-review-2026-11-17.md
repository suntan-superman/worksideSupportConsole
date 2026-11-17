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
- An existing authorized operator login verified `GET /support/products/health` returns 200; the operator's scope returns one Merxus row with `unknown` health. `GET /support/products/merxus/releases/latest` returns the documented `404 RELEASE_NOT_FOUND`. The Route Logistics latest-release request returns `403 FILTER_ACCESS_DENIED` for this Merxus-scoped operator, so that product's release record cannot be inspected under this account. Authenticated browser requests confirmed CORS works.
- The live Product Health table shows all five catalog entries with `unknown` status, and Route Logistics is present in the support Product filter. The production table does not include the new Data Freshness column, so the current Netlify frontend has not been confirmed to contain the committed release's freshness and feed-error display changes.
- The Support Console production site is `https://support.worksidesoftware.com` and is served by Netlify. The frontend release was committed and pushed directly to `main` (`3d11a9f66c7a8f64560463375a57b77e00577720`, followed by the smoke-test correction `7a99d10`). Netlify still serves a different bundle from the local production build. No Netlify CLI, site link, deploy hook, or deployment credential is available in this workspace, so a production deployment ID could not be obtained.
- Local Puppeteer smoke checks confirm all five Product Health rows show Unknown when no records exist, Route Logistics is in the Product filter, and the sessions/detail/heartbeat request path remains wired. No actionable live transfer was available to accept during the operator check; backend transfer regression tests passed.

## Remaining Unknown values and follow-up

- No authoritative source adapters were found for QA, Meta, Stripe, Auth, Email, or Notifications. The production dashboard must show Unknown until those sources are connected.
- No release archive source or record store was found. The latest-release endpoint correctly returns a missing-record response.
- The existing backend checkout contained unrelated uncommitted work before this change. No backend files were committed or pushed; the deployment-only policy was followed.
- Cloud Run environment metadata was reviewed without printing values. Credential variables are Secret Manager references; the plaintext Twilio account identifier and account-key selectors are not credentials. No secret value was confirmed exposed by the deployment output, so no credential rotation is indicated.

## Additional review item

`npm ci` in the Support Console reported 33 dependency advisories in the full dependency tree (1 critical, 18 high, 13 moderate, and 1 low). This summary was not triaged in this Product Health change; review production-impacting advisories separately.

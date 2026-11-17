# Operational Platform Checklist

Date: 2026-06-28

## Completed

- [x] Reviewed roadmap in `docs/workside-support-console-operational-platform-codex-plan.md`.
- [x] Created backend enforcement verification contract.
- [x] Created support lifecycle contract.
- [x] Created canonical backend response contract.
- [x] Created notification receipt contract.
- [x] Created mobile auth security contract.
- [x] Created mobile signing boundary doc.
- [x] Created security audit remediation doc.
- [x] Created security risk acceptance doc.
- [x] Added opt-in Playwright lifecycle/failure scaffolding.
- [x] Added production audit npm scripts.
- [x] Removed unused root production dependencies.
- [x] Upgraded `firebase-admin` to `14.1.0`.
- [x] Added Expo SecureStore.
- [x] Migrated mobile bearer token storage from AsyncStorage to SecureStore.
- [x] Added mobile push token registration service.
- [x] Added mobile push token revoke on logout.
- [x] Added mobile notification deep-link handler.
- [x] Removed hard-coded Merxus-only mobile queue behavior.
- [x] Added mobile support product loading.
- [x] Added mobile product selector.
- [x] Added assigned-to-me mobile query behavior for Mine queue.
- [x] Added full mobile availability selector.
- [x] Added mobile internal notes UI/service.
- [x] Added mobile lead capture UI/API action.
- [x] Added mobile inquiry capture UI/API action.
- [x] Added product health service and dashboard renderer.
- [x] Wired product health panel into web console with Unknown fallback state.
- [x] Added release archive service and renderer foundation.
- [x] Added session diagnostics service and product context renderer foundation.
- [x] Wired session product/release context into session detail.
- [x] Added notification receipt service and timeline renderer foundation.
- [x] Wired dedicated notification receipt timeline into session detail.
- [x] Added knowledge base model contract.
- [x] Added smart widget handoff contract.
- [x] Added customer timeline contract.
- [x] Added billing context contract.
- [x] Added unit render tests for product health, release archive, session product context, and notification timeline.
- [x] Synced Playwright smoke test with product health and notification receipt UI.
- [x] Added Puppeteer product health smoke test with mocked support APIs.
- [x] Synced Playwright and Puppeteer smoke tests with session product/release context.
- [x] Wired release archive view into the web console.
- [x] Synced Playwright and Puppeteer smoke tests with release archive records.
- [x] Updated `npm run test:puppeteer` to run route smoke plus product-health smoke.
- [x] Corrected release route smoke config to the actual SPA route (`/`).
- [x] Updated `.gitignore` for future signing artifacts.
- [x] Documented implementation results in `docs/operational-platform-implementation-log-2026-06-28.md`.
- [x] Verified `npm test` passes.
- [x] Verified `npm run build` passes.
- [x] Verified `npm run mobile:typecheck` passes.

## Partially Complete

- [ ] Dependency audit remediation.
  - [x] Removed high/critical advisories from latest observed audit output.
  - [x] Reduced root audit to 6 moderate transitive advisories.
  - [x] Reduced mobile audit to 20 moderate transitive advisories.
  - [ ] Resolve or formally accept remaining moderate advisories.
- [ ] Product health dashboard.
  - [x] Frontend service/render foundation exists.
  - [x] Web panel is visible.
  - [ ] Backend `/support/products/health` endpoint still needed.
- [ ] Release certification archive.
  - [x] Frontend service/render foundation exists.
  - [x] Session detail can show latest release context when backend endpoint exists.
  - [x] Archive view is wired into the web console.
  - [ ] Backend/archive endpoints still needed.
  - [x] Wire archive view into navigation/workflow.
- [ ] Notification observability.
  - [x] Frontend contract/service/render foundation exists.
  - [x] Session detail renders a dedicated notification timeline.
  - [ ] Backend receipt persistence still needed.
- [ ] Mobile push.
  - [x] Client token registration/revoke implemented.
  - [x] Deep-link handler implemented.
  - [ ] Backend push token endpoints still needed.
  - [ ] Backend push payload must include `sessionId`.
- [ ] Mobile feature parity.
  - [x] Product scope, notes, lead, inquiry, availability controls implemented.
  - [ ] Device testing still needed.
  - [ ] Friendly session-not-found/permission-denied screen still needed.
- [ ] Web maintainability.
  - [x] New low-risk modules added.
  - [ ] `src/main.js` still needs deeper controller/render extraction.

## Remaining P0 / Production Safety

- [ ] Implement backend enforcement tests in the backend repository.
- [ ] Verify every `/support/*` route validates Firebase tokens.
- [ ] Verify active support-user record is required.
- [ ] Verify disabled support users are rejected.
- [ ] Verify role, product, tenant, and department scopes are enforced.
- [ ] Verify viewer cannot perform write actions.
- [ ] Verify reply before takeover is rejected server-side.
- [ ] Verify takeover/transfer/close invalid state transitions are rejected server-side.
- [ ] Verify close without required lead/inquiry data is rejected server-side.
- [ ] Verify blocked and successful protected actions create audit logs.
- [ ] Run full support lifecycle tests against a safe staging environment.
- [ ] Confirm lead save is immediately visible in list/detail read models.
- [ ] Confirm inquiry save is immediately visible in list/detail read models.
- [ ] Confirm transcript send works with safe defaults.

## Remaining P1 / Platform Foundation

- [ ] Implement `/support/products/health`.
- [ ] Implement release archive endpoints.
- [x] Wire release archive view into web console.
- [x] Wire session product context into session detail.
- [ ] Implement notification receipt persistence.
- [x] Wire notification timeline into session detail.
- [ ] Implement `/support/mobile/push-tokens`.
- [ ] Implement push token duplicate handling and revoke semantics.
- [ ] Add push notification session deep-link payloads.
- [ ] Add `GET /support/me` as canonical current-user/scope endpoint.
- [ ] Add admin coverage view.

## Remaining P2 / AI, Context, And Scale

- [ ] Implement knowledge base API.
- [ ] Implement knowledge base admin UI.
- [ ] Implement smart widget handoff backend payload.
- [ ] Render AI handoff summary in session detail.
- [ ] Add suggested agent replies.
- [ ] Implement customer timeline API.
- [ ] Render customer timeline.
- [ ] Implement billing context API.
- [ ] Render safe billing context panel.
- [ ] Add dedicated queue views.
- [ ] Add SLA and aging indicators.
- [ ] Add metrics dashboard.

## Remaining Testing / Release Certification

- [ ] Add executable web Playwright tests for core workflows.
- [x] Add mocked Playwright smoke coverage for product health and notification receipts.
- [x] Add Puppeteer smoke coverage for product health and notification receipts.
- [x] Add browser smoke coverage for session product/release context.
- [x] Add browser smoke coverage for release archive records.
- [ ] Add mobile tests for auth, dashboard filters, session detail, availability, secure token storage, push registration, and deep links.
- [ ] Add release certification output for mobile typecheck and audit status.
- [ ] Archive release reports and certificates.
- [ ] Make WSC appear in its own product health dashboard from real release data.

## Current Validation Status

- [x] `npm test` passes.
- [x] `npm run build` passes.
- [x] `npm run mobile:typecheck` passes.
- [ ] `npm run audit:prod` still fails with 6 moderate transitive advisories.
- [ ] `npm run mobile:audit:prod` still fails with 20 moderate transitive advisories.

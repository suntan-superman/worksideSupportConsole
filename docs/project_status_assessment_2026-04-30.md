# Project Status Assessment - Workside Support Console

Date: 2026-04-30

Scope reviewed:

- Frontend: `src/main.js`, `src/services/api.js`, `src/services/auth.js`, `src/services/chat.js`, `src/services/chatErrors.js`, `src/style.css`
- Frontend docs: `AGENTS.md`, `AI_CONTRACT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `docs/support_transcript_assignment_task_plan.md`, `docs/backend_support_error_contract_review.md`, `docs/backend_support_user_auth_onboarding_tasklist.md`
- Backend read-only sample: `C:\Users\sjroy\Source\Merxus\merxus-ai-backend\src\modules\support\...`

## 1. Executive Summary

The support console is now a functional late-alpha / early-beta operational tool. It has the right architectural direction: a thin vanilla Vite frontend, backend-enforced state transitions, Firebase auth, support user/departement administration, assignment, transcript, OTP login, and diagnostics.

The largest production risk is not the UI surface anymore. It is contract drift and data quality between the Merxus call/session creation paths and the support module. Recent bugs showed this clearly:

- sessions entered the support queue without real tenant metadata
- support list filters silently persisted across users
- support user lookup returned success but still logged audit failures
- caller name/lead capture data was present in one backend field but absent from canonical lead fields

Current maturity: usable for supervised internal testing, not production-ready until the backend contracts and end-to-end tests are hardened.

Biggest risks:

- P0: new support sessions can still be created with incomplete or inconsistent lead/contact data.
- P0: support queue visibility can be wrong if backend assignment/filter contracts drift.
- P0: backend route-level tests are not yet proving the exact payloads the frontend depends on.
- P1: support user/auth/claims lifecycle is still operationally fragile.
- P1: audit/logging is present but not yet consistently reliable.

## 2. What Is Working Well

The frontend has converged around a practical operator workflow in `src/main.js`:

- global product, tenant/customer, status, urgency, and assigned-to filters
- session list and detail panes
- lead capture and inquiry intake panels
- transfer request, takeover, reply, close, no-follow-up close
- assignment dialog and transcript dialog
- super-admin support user and department admin tabs
- diagnostics panel based on endpoint traces from `src/services/chat.js`

The API client layering is reasonable:

- `src/services/api.js` centralizes bearer-token transport and structured backend error parsing.
- `src/services/chat.js` normalizes inconsistent backend response shapes defensively.
- `src/services/chatErrors.js` keeps workflow error interpretation out of the rendering code.
- `src/services/auth.js` supports Firebase password login, password reset, OTP, and custom-token exchange.

The backend support module has the right separation shape:

- `supportRoutes.js` registers canonical support and admin endpoints.
- `supportAccessService.js` resolves Firebase claims, support roles, allowed products, and allowed tenants.
- `supportScopeService.js` enforces tenant/product scope and write roles.
- `supportSessionService.js` maps sessions, enforces state transitions, handles request-transfer/takeover/reply/assign/transcript/close.
- `supportDirectoryService.js` owns support users and departments.

Important backend improvements are already present:

- `deriveSessionTenantId()` rejects invalid identifiers such as `default`, `undefined`, and `null`.
- `mapSessionSummary()` now returns canonical `status` values: `active_ai`, `escalated`, `active_human`, `closed`.
- tenant-context-missing sessions can be marked with `tenantContextMissing`, `actionable: false`, and `requiredAction: repair_session_tenant`.
- `GET /support/users?product=merxus` now returns `200`, which unblocks the assigned-to dropdown.

## 3. Gaps / Risks - Critical

### P0 - Session Creation And Tenant Integrity

Observed failure: sessions appeared as `Tenant/Customer: undefined`, then backend correctly rejected detail/action routes with tenant-context errors.

Backend now has `assertSessionTenantContext()` in `supportSessionService.js`, but the upstream creation paths still need proof. Every support-visible `callSessions` record must be created with a real tenant context before it can enter the support queue.

Required backend behavior:

- persist `tenantId`
- persist `tenantType`
- persist type-specific id when applicable: `officeId`, `restaurantId`, or `agentId`
- reject or quarantine sessions that cannot derive tenant context
- do not show tenant-context-missing sessions in normal operator queues

Production blocker because tenant context is the foundation for authz, queue visibility, assignment, and audit.

### P0 - Lead Capture Canonicalization

Observed failure: the caller gave a name (`Steve Smith`), and the backend returned it as tenant/customer or organization metadata, but not as canonical `leadName`. The frontend now infers the display name, but that is only a UX safety net.

Backend must write caller-provided contact info into canonical lead/contact fields:

- `leadName`
- `leadEmail`
- `leadPhone`
- `leadCaptured`
- `lead.missingFields`

If email is required by policy, the AI/call flow must ask for it. If no email is captured, return `leadCaptured: false` and missing field `email`.

Production blocker because close/transfer behavior depends on whether lead identity is truly complete.

### P0 - Queue Visibility And Assigned Filter Contract

Observed failure: UI displayed `Assigned To: All`, while the API was still querying `assignedTo=sroy@...`. The frontend now fixed the dropdown/state mismatch, but backend contract still matters.

Backend `matchesSessionFilter()` in `supportSessionService.js` currently matches assigned users using:

```js
const haystack = `${assigned.uid || ""} ${assigned.email || ""} ${assigned.name || ""}`.toLowerCase();
haystack.includes(readScope.assignedTo)
```

This is flexible but not rigorous. It can produce surprising matches and makes it hard to reason about id/email/name filtering.

Recommended backend improvement:

- accept `assignedTo` as exact uid/email/name match
- preferably add explicit `assignedToUserId`
- support `assignedTo=unassigned`
- document which value the frontend should send

Production blocker until tested with super_admin, support_agent, unassigned sessions, assigned sessions, and newly created sessions.

### P0 - Backend Route-Level Test Coverage

Docs already call this out in `docs/backend_support_error_contract_review.md`. Service logic exists, but production readiness requires exact HTTP route payload tests.

Must test:

- `GET /support/sessions` with product only, no assignedTo
- `GET /support/sessions` with assignedTo exact id/email
- `GET /support/sessions/:id` for accessible and inaccessible tenants
- request-transfer without required lead/inquiry
- takeover before/after valid escalation
- reply before takeover
- assign unauthorized assignee
- transcript without email
- close without lead
- tenant-context-missing session excluded by default

Production blocker because the console has repeatedly exposed route-contract regressions.

## 4. Remaining Work - Prioritized

### P0 - Blocking Production

1. Harden support session creation.
   - Ensure all paths creating `callSessions` write valid tenant/product metadata.
   - Reject/quarantine sessions that cannot resolve tenant context.
   - Add tests around voice/website/SMS/call creation paths.

2. Canonicalize lead/contact extraction.
   - Save caller-provided name into `leadName`.
   - Save phone into `leadPhone`.
   - Ask for email when email is policy-required.
   - Return missing field details consistently.

3. Lock the support sessions list contract.
   - Verify `GET /support/sessions?product=merxus` returns all accessible active sessions for super_admin.
   - Verify no stale assignment filtering is applied server-side.
   - Add exact response tests.

4. Complete backend error contract tests.
   - Use canonical codes from `docs/backend_support_error_contract_review.md`.
   - Include `requiredAction`, `missingFields`, and `sessionId`.

5. Validate role and tenant isolation end to end.
   - `super_admin`
   - `support_agent`
   - `viewer`
   - allowed tenant
   - disallowed tenant
   - `__all__` tenant access

### P1 - High Value

1. Fix support audit logging warning.
   - Logs still show `[support.users.list] audit logging failed` with `Cannot read properties of undefined (reading 'name')`.
   - This is no longer breaking the route, but audit failures reduce operational trust.

2. Clarify assigned user values.
   - Frontend currently sends whichever selected user value is available.
   - Backend should prefer a single stable id and return that id in user/list/session payloads.

3. Add admin session repair UI or diagnostics.
   - Backend has `PATCH /support/admin/sessions/:id/tenant`.
   - Frontend currently blocks bad sessions but does not provide a repair workflow.
   - A super-admin-only repair drawer would reduce operational dead ends.

4. Add explicit “missing lead email” UX.
   - Frontend currently requires email before close.
   - Backend should return `missingFields: ["email"]`.
   - UI should show field-specific text beside Email.

5. Improve transcript readiness.
   - Confirm backend transcript builder excludes internal actions and diagnostics.
   - Add visible transcript history/timestamp in detail pane.

### P2 - Polish / Scale

1. Replace 5-second polling with SSE/WebSocket when backend event stream is ready.
2. Add pagination and cursor handling to session list.
3. Add metrics dashboard from `/support/metrics`.
4. Add leads and inquiries queue views from `/support/leads` and `/support/inquiries`.
5. Add audit timeline in the session detail view.
6. Add release-to-AI if this remains in the intended design.

## 5. Missing Features Vs Spec

From `docs/workside_support_console_spec.md`, the current console covers the core live-session workflow but is not complete against the broader command-center spec.

Implemented or mostly implemented:

- global support login
- product and tenant filters
- session queue
- session detail
- lead capture
- inquiry intake
- human takeover
- agent reply
- close
- assignment
- transcript send
- support user admin
- department admin
- role-based admin visibility
- diagnostics

Missing or partial:

- metrics dashboard
- dedicated leads queue
- dedicated inquiries queue
- session audit timeline
- pagination/cursors
- real-time event stream
- release-to-AI
- complete support preferences UI
- tenant/customer drilldown
- admin session repair UI
- route-level automated test evidence
- production-grade notification/audit observability

Important mismatch:

- `docs/workside_support_console_global_support_model.md` says action endpoints should use only `sessionId` and backend should load/enforce tenant/product. The frontend still sends tenant/product defensively in several action payloads. This is tolerable compatibility glue, but the long-term contract should be backend-derived session context only.

## 6. Recommended Next Sprint Plan - 1 To 3 Days

### Day 1 - Stabilize Queue Visibility

1. Backend: add tests for `GET /support/sessions?product=merxus` as super_admin and support_agent.
2. Backend: verify new support-call session appears without assignedTo filter.
3. Backend: fix audit logging warning in support users list.
4. Frontend: manually QA assigned-to dropdown after user switch, refresh, logout/login.

Success signal:

- New Merxus support call appears in the console within one polling interval.
- Network/logs show `/support/sessions?product=merxus`, not stale `assignedTo`.

### Day 2 - Stabilize Lead/Tenant Data

1. Backend: update call/session creation to always persist canonical tenant fields.
2. Backend: update AI/call extraction to save name into canonical lead fields.
3. Backend: ask for email if tenant policy requires email before close.
4. Backend: add tests for Steve Smith-style caller data.

Success signal:

- Session list shows caller name from canonical `leadName`.
- Lead Capture preloads from backend lead fields, not frontend inference.
- Email missing is returned as `missingFields: ["email"]`.

### Day 3 - Contract And Regression Tests

1. Add route-level tests for support state transitions.
2. Add role/tenant isolation tests.
3. Add assignment and transcript route tests.
4. Confirm frontend diagnostics show clean `ok` statuses for products, tenants, sessions, users, departments, detail.

Success signal:

- No known support route returns unexpected 500.
- Expected workflow blocks return 4xx with canonical code and requiredAction.

## 7. Definition Of Done For Production

### Backend

- [ ] Every support-visible session has valid tenant and product context.
- [ ] Tenant-context-missing sessions are excluded from normal queues or shown only in admin repair diagnostics.
- [ ] Lead/contact fields are canonicalized on session creation and update.
- [ ] Required lead fields are policy-driven and enforced server-side.
- [ ] Inquiry capture is policy-driven and enforced server-side.
- [ ] Transfer lifecycle cannot be bypassed.
- [ ] Reply requires human takeover.
- [ ] Close requires lead and inquiry when policy requires them.
- [ ] Assignment validates assignee activity, product, tenant, and department.
- [ ] Transcript excludes internal-only data.
- [ ] Auth claims are synchronized with support user records.
- [ ] Route-level tests assert exact status codes and JSON payloads.
- [ ] Audit writes succeed or fail visibly without breaking user workflows.

### Frontend

- [ ] Login works with password and OTP.
- [ ] Support role badge stabilizes after login.
- [ ] Filters reflect actual query state.
- [ ] Polling does not clear active form focus or modal state.
- [ ] New sessions appear within one polling interval.
- [ ] Action buttons are disabled when backend policy says action is unavailable.
- [ ] Workflow blockers use inline guidance or warning banners, not raw errors.
- [ ] Diagnostics clearly show failing endpoint, code, and requiredAction.
- [ ] Super-admin admin panel can manage users and departments safely.

### End-To-End QA

- [ ] super_admin can see all accessible Merxus sessions.
- [ ] support_agent can see assigned/authorized sessions only.
- [ ] viewer cannot write.
- [ ] unauthorized tenant access is blocked.
- [ ] new support call appears in queue.
- [ ] caller name, phone, and email behavior matches lead policy.
- [ ] accept transfer, reply, assign, send transcript, close all work on a valid session.
- [ ] broken data states produce actionable admin guidance.

## Bottom Line

The project is close enough for structured internal QA, but not production-ready. The console is now strong enough to expose backend/data contract issues quickly. The next production push should focus less on UI features and more on making session creation, lead capture, queue filtering, and route-level tests boringly reliable.

# Project Status Assessment - Workside Support Console

Date: 2026-05-03

## Scope Reviewed

- Frontend: `src/main.js`, `src/services/api.js`, `src/services/auth.js`, `src/services/chat.js`, `src/services/chatErrors.js`, `src/style.css`
- Frontend docs: `docs/project_status_assessment_2026-04-30.md`, `docs/support_transcript_assignment_task_plan.md`, `docs/mobile_support_app_spec.md`, `docs/backend_support_error_contract_review.md`, `docs/workside_support_console_spec.md`, `docs/architecture.md`
- Backend read-only sample: `C:\Users\sjroy\Source\Merxus\merxus-ai-backend\src\modules\support\...`
- Backend tests sampled: `supportGlobalModel.test.js`, `supportCaptureEnforcement.test.js`, `supportTransferStateMachine.test.js`, `supportHttpErrorContract.test.js`

## 1. Executive Summary

The support console has moved from late-alpha/early-beta into a credible internal beta. The core live transfer-to-human path is now present end to end: support authorization, session queue, lead capture, inquiry capture, human request, takeover, reply, notes, transcript send, assignment, departments, support users, availability, heartbeat, and admin notification mute controls.

Current system maturity: **internal beta / controlled pilot**, not yet full production.

The biggest production risks are no longer basic feature absence. They are now:

- Contract drift between browser widget, support console, and backend session state.
- Thin automated coverage around the exact deployed HTTP/API payloads the console depends on.
- Operational ambiguity around realtime vs polling, notification delivery, and agent availability expiry.
- Frontend maintainability risk because most workflow state and rendering lives in one large `src/main.js` module.

The system is strong enough for serious internal QA. It should not be considered production-ready until the next round of route-level tests, cross-client transfer tests, and notification/availability failure-mode tests are completed.

## 2. What Is Working Well

### Frontend Workflow

`src/main.js` now covers the practical support-operator workflow:

- product, tenant/customer, status, urgency, assigned-to, sort, and availability controls
- session list/detail split view
- stable selected session handling across polling
- lead capture and inquiry intake
- transfer request, takeover, reply, close, no-follow-up close
- internal notes with save and close-resolution behavior
- customer-safe transcript send
- assignment and reassignment
- active conversation tabs for multiple assigned sessions
- support admin users/departments tabs
- availability state and heartbeat
- super-admin admin notification mute
- API diagnostics panel

The UI has evolved from a raw API console into a real operations surface.

### API Client Layer

`src/services/api.js` is a clean transport layer:

- centralizes API base URL construction
- attaches Firebase/local bearer tokens
- parses nested and flat backend error shapes
- preserves `code`, `requiredAction`, `missingFields`, and `sessionId`

`src/services/chat.js` is doing heavy but useful normalization:

- maps backend status variants into `active_ai`, `escalated`, `active_human`, `closed`
- normalizes lead/contact fields across multiple backend shapes
- normalizes transfer, assignment, transcript, note, routing, and availability fields
- records endpoint traces for diagnostics
- falls back from `/support/sessions/:id/transcript` to `/send-transcript` for compatibility

This defensive normalization has been valuable during rapid backend/frontend alignment.

### Authentication And Authorization

`src/services/auth.js` supports:

- Firebase email/password login
- Firebase password reset
- OTP send/verify
- custom token exchange
- token refresh and local token fallback

The frontend now also gates unauthorized support-console users before allowing normal app usage. This fixed the earlier problem where a normal Merxus Firebase user could land in the support console and then only fail after API calls.

Backend routes in `supportRoutes.js` show the right separation:

- normal support middleware for operator routes
- super-admin middleware for admin-only user/department/session repair/mute routes

### Backend Support Surface

The backend support module now exposes the expected route family:

- `/support/sessions`
- `/support/sessions/:id`
- `/support/sessions/:id/request-transfer`
- `/support/sessions/:id/takeover`
- `/support/sessions/:id/reply`
- `/support/sessions/:id/close`
- `/support/sessions/:id/lead`
- `/support/sessions/:id/inquiry`
- `/support/sessions/:id/notes`
- `/support/sessions/:id/transcript`
- `/support/users/me/availability`
- `/support/users/me/heartbeat`
- `/support/admin/notification-mute`
- admin users/departments/session tenant repair

The sampled backend tests show real progress:

- `supportCaptureEnforcement.test.js` covers lead/inquiry enforcement.
- `supportTransferStateMachine.test.js` covers transfer transition rules.
- `supportHttpErrorContract.test.js` covers canonical error normalization and actionable payloads.
- `supportGlobalModel.test.js` appears to exercise broad support service behavior using Firestore-style stubs.

### Recent Product Improvements

Since the April 30 assessment, these important gaps have been materially improved:

- support console access restriction for support users
- customer-safe transcript default behavior
- internal notes and close-resolution notes
- live transfer history preservation after takeover
- availability status and heartbeat
- backend routing fields surfaced in the UI
- admin notification mute endpoint and UI control
- mobile support app MVP spec in `docs/mobile_support_app_spec.md`

## 3. Gaps / Risks - Critical

### Critical - Exact Cross-Client Transfer Contract Still Needs End-To-End Proof

The browser widget, backend, and support console now appear aligned, but this path has had multiple recent failures:

- widget displayed “Team notified” while console still showed `AI`
- takeover temporarily cleared visible history
- backend returned transfer state in fields the frontend did not initially recognize

The frontend now tolerates many transfer flags in `src/services/chat.js`, but production readiness requires the backend to return one canonical shape:

```json
{
  "status": "escalated",
  "transferRequested": true,
  "routingStatus": "assigned",
  "availabilityOutcome": "available_agent_found"
}
```

Required proof:

- browser widget request creates/updates a support session
- session appears in console queue within one polling interval
- queue count increments
- takeover preserves messages
- reply is visible to customer
- transcript contains customer/human conversation only by default

### Critical - Notification Delivery Is Now Part Of The Product, But Not Yet Fully Observable

The design now depends on:

- SMS notification to assigned support user
- console audible notification
- admin notification when no agent is available
- admin mute behavior
- future mobile push

The console has UI hooks, but production readiness needs backend evidence for every notification attempt:

- attempted
- channel
- provider
- recipient
- sent/failed
- error reason
- muted/skipped reason

Session detail currently surfaces assignment/transcript/routing, but not a complete notification timeline. Without that, support staff cannot distinguish “nobody was notified” from “notified but did not respond.”

### Critical - Availability Semantics Need A Hard Backend Expiry Rule

Frontend sends heartbeat every 45 seconds while `availability.status === "available"` in `src/main.js`. This is appropriate, but backend must be authoritative:

- available users must expire to away/offline when heartbeat stops
- mobile/background behavior must not leave users falsely available
- do-not-disturb and `quietUntil` must block assignment/notification

Risk: customers could be told someone is available when the operator walked away or closed the browser.

### Critical - Automated Frontend Coverage Is Missing

`package.json` has only:

```json
"build": "vite build"
```

There is no frontend test runner, no Playwright smoke test, and no contract fixture tests for `src/services/chat.js`.

This is a production risk because the frontend has complex state behavior:

- polling/focus preservation
- selected session preservation
- live transfer button enablement
- lead/inquiry close enforcement
- transcript options
- availability heartbeat
- admin dialogs

At minimum, add tests around normalization and a Playwright happy path.

### Critical - `src/main.js` Is Too Large For The Current Risk Level

Nearly all frontend state, rendering, events, and workflow logic lives in `src/main.js`.

This was efficient while the system was changing daily, but it is now a maintainability risk. The file owns:

- auth screen
- polling
- filtering/sorting
- session list
- session detail
- all dialogs
- admin panel
- availability
- notes
- transcript
- assignment
- error routing

Production work can continue, but the next stabilization phase should split modules by workflow before the file becomes too expensive to change safely.

## 4. Remaining Work - Prioritized

### P0 - Blocking Production

1. Add deployed-route integration tests for the complete human transfer path.
   - Browser/public chat requests human.
   - Backend persists `status: "escalated"`.
   - Console lists the session.
   - Support user accepts.
   - Message history remains.
   - Support reply reaches customer.

2. Add backend availability expiry tests.
   - Available with recent heartbeat is assignable.
   - Available with stale heartbeat is not assignable.
   - Busy/away/offline/do-not-disturb are not assignable.
   - `quietUntil` suppresses assignment/notification until expired.

3. Add notification audit/receipt tests.
   - Assigned support user SMS attempted.
   - Admin notified when no agent available.
   - Admin mute prevents admin notification.
   - Notification failure does not roll back session transfer state.

4. Add frontend normalization tests for `src/services/chat.js`.
   - status mapping
   - transfer requested variants
   - routing fields
   - support notes
   - transcript receipts
   - lead/contact fallback fields

5. Add at least one browser smoke test.
   - Login as support user.
   - Load sessions.
   - Select session.
   - Accept transfer.
   - Send reply.
   - Save note.
   - Send transcript.

### P1 - High Value

1. Split `src/main.js`.
   - `render/sessionList.js`
   - `render/sessionDetail.js`
   - `workflows/sessionActions.js`
   - `workflows/adminActions.js`
   - `state/polling.js`
   - `state/availability.js`

2. Replace compatibility fallbacks once contracts settle.
   - Remove `/send-transcript` fallback after all deployments use `/transcript`.
   - Reduce broad transfer flag tolerance once backend canonical fields are proven.

3. Surface notification history in the session detail.
   - Assignment notification sent/failed.
   - SMS sent/failed.
   - Admin notification skipped due to mute.
   - Mobile push sent/failed later.

4. Add admin-facing availability coverage.
   - list available users by department
   - show no-agent-available coverage warnings
   - expose stale heartbeat age

5. Make active filters more obvious.
   - The recent super-admin confusion was caused by `Status = AI` hiding closed sessions.
   - Add a compact active-filter summary in the Sessions panel.

### P2 - Polish / Scale

1. Move from polling-only to SSE/WebSocket when Cloud Run/realtime path is verified.
2. Add pagination/cursors for session list.
3. Add metrics dashboard from `/support/metrics`.
4. Add dedicated leads, inquiries, and audit views.
5. Add mobile app implementation using `docs/mobile_support_app_spec.md`.
6. Add visual notification preferences per support user.

## 5. Missing Features Vs Spec

Implemented or mostly implemented:

- support-console auth and support-user authorization
- super-admin support admin panel
- departments and support users
- product/tenant/status/urgency/assigned filters
- sorting by initial or last interaction date
- lead capture
- inquiry capture
- transfer request
- takeover
- reply
- internal notes
- close and close no-follow-up
- assignment
- customer-safe transcript
- availability and heartbeat
- admin notification mute
- API diagnostics

Still missing or partial:

- true realtime subscription despite `VITE_SUPPORT_REALTIME_URL`
- notification event timeline
- frontend automated tests
- active filter summary
- session audit timeline
- admin session repair UI
- metrics dashboard
- leads and inquiries queue views
- mobile support app implementation
- push notification registration and device token management
- production monitoring/alerting docs

Important mismatch:

- `docs/architecture.md` describes realtime delivery as part of the target architecture, but `src/main.js` currently labels polling as “Live updates every 5 seconds.” This is usable, but the product/ops language should be precise: it is polling, not realtime.

## 6. Recommended Next Sprint Plan - 1 To 3 Days

### Day 1 - Prove Transfer And Availability

1. Backend: add tests for availability routing outcomes.
2. Backend: add tests for no-agent-available notification behavior.
3. Frontend: add fixture tests for `normalizeSession()` and `normalizeSessionAndMessages()` in `src/services/chat.js`.
4. Manual QA: public widget request -> console queue -> takeover -> reply -> transcript.

Success signal:

- No manual screenshots are needed to prove the path; tests or logs show the exact transition chain.

### Day 2 - Add Observability

1. Backend: return notification receipts/timeline on session detail.
2. Frontend: render notification/routing timeline in detail panel.
3. Backend: include heartbeat age and availability effective status in support users payload.
4. Frontend: show stale/available/away coverage in admin panel.

Success signal:

- An admin can answer “who was notified, by which channel, and what happened?” from the console.

### Day 3 - Stabilize Frontend Structure

1. Extract API-independent normalization tests.
2. Extract rendering helpers from `src/main.js`.
3. Add Playwright smoke test for login and session selection.
4. Add active-filter summary to reduce operator confusion.

Success signal:

- `npm run build` plus `npm test` or equivalent catches regressions before deployment.

## 7. Definition Of Done For Production

### Backend

- [ ] Human request persists canonical `status: "escalated"` and `transferRequested: true`.
- [ ] Routing status and availability outcome are returned by list and detail routes.
- [ ] Availability expires when heartbeat is stale.
- [ ] Assignment respects department, product, tenant, active status, quietUntil, and availability.
- [ ] Notification receipts are persisted and visible.
- [ ] Notification failure does not roll back session state.
- [ ] Transcript defaults exclude AI/system/internal notes.
- [ ] Internal notes never appear in customer transcript unless internal/admin mode is explicitly selected.
- [ ] Lead and inquiry capture are enforced server-side.
- [ ] Reply is impossible before takeover.
- [ ] Close is impossible when required lead/inquiry data is missing.
- [ ] Super-admin can see all sessions unless explicit filters are applied.
- [ ] Support users can see only authorized sessions.
- [ ] Route-level tests cover expected 2xx/4xx payloads.

### Frontend

- [ ] Unauthorized Firebase users are blocked before home screen.
- [ ] Availability selector and heartbeat work without blocking normal polling.
- [ ] Session list preserves selection across polling.
- [ ] Action buttons reflect backend-enforced state.
- [ ] Transfer acceptance never clears message history.
- [ ] Customer-safe transcript options are default.
- [ ] Internal notes save and reload.
- [ ] Admin mute action gives clear feedback.
- [ ] Diagnostics show useful endpoint/code/requiredAction data.
- [ ] Frontend tests cover normalization and core UI workflow.

### End-To-End QA

- [ ] Visitor requests human from web widget.
- [ ] Available assigned support user receives notification.
- [ ] No-agent-available path informs customer and notifies admin.
- [ ] Support user accepts transfer and replies.
- [ ] Customer receives reply in widget.
- [ ] Transcript email contains only customer/human content by default.
- [ ] Internal note is not exposed to customer.
- [ ] Super-admin sees all sessions with filters cleared.
- [ ] Support agent sees only assigned/authorized sessions.
- [ ] Availability stale state prevents false assignment.

## Bottom Line

The project is now a serious internal beta. The core product loop is present and increasingly coherent. The remaining production work is less about adding UI and more about proving contracts, notification reliability, availability truthfulness, and regression safety.

The next best investment is automated evidence: route tests, normalization tests, and one browser smoke test that proves the live transfer path repeatedly without relying on screenshots.


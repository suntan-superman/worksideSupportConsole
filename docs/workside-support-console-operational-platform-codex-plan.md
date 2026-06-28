# Workside Support Console — Company-Wide Operational Platform Codex Plan

Date: 2026-06-28  
Target Repository: `C:\Users\sjroy\Source\WorksideSupportConsole`  
Related Products: SageSet, Merxus AI, RadiusIQ, Workside Support Console  
Objective: Evolve Workside Support Console from an internal support app into the central company-wide operational platform for Workside Software LLC.

---

## 1. Strategic Goal

The Workside Support Console should become the operational command center for all Workside Software LLC products.

It should support:

- AI-assisted customer support
- Human takeover and escalation
- Product-specific support queues
- Release certification visibility
- Product health monitoring
- Billing and subscription support context
- Customer history and timelines
- Notification observability
- Mobile support operations
- Admin management
- Knowledge base integration
- Cross-product diagnostics

This is not just a support desk. It should become the internal operating layer that lets Workside launch and support multiple SaaS products without multiplying operational complexity.

---

## 2. Current State Summary

The app is already a credible internal operations product.

The current codebase review identifies the product as a controlled internal beta / pilot with:

- Functional web console
- Functional Expo/React Native mobile companion
- Support queues
- Human takeover
- Agent replies
- Closing and escalation flows
- Assignment
- Availability
- Diagnostics
- Transcript sending
- Admin management
- Mobile monitoring and replies

However, the review identifies major remaining risks:

- Backend enforcement proof
- Security hardening
- Dependency audit remediation
- Notification observability
- Mobile production readiness
- Contract stabilization
- Frontend maintainability
- Release certification artifacts
- Realtime-vs-polling clarification

Codex should treat the frontend as substantial but not production-certified until backend authority, security, and operational observability are proven.

---

## 3. North Star Architecture

Implement the Workside Support Console as a company-wide operational platform with these modules:

```text
Workside Support Console
│
├── Support Operations
│   ├── Product queues
│   ├── Human takeover
│   ├── Replies
│   ├── Transfers
│   ├── Escalations
│   ├── Internal notes
│   └── Close/resolution workflows
│
├── AI Support Layer
│   ├── Smart chat widget ingestion
│   ├── Knowledge base answers
│   ├── Human handoff summaries
│   ├── Suggested replies
│   ├── Issue classification
│   └── Confidence and escalation rules
│
├── Customer Timeline
│   ├── Conversations
│   ├── Support tickets
│   ├── Product events
│   ├── Subscription events
│   ├── Release exposure
│   └── Prior issues
│
├── Product Health
│   ├── Latest release certification
│   ├── Meta Pixel status
│   ├── Stripe status
│   ├── Firebase/API health
│   ├── SendGrid/email health
│   ├── Notification health
│   └── Known incidents
│
├── Release Certification
│   ├── Latest QA reports
│   ├── Archived release reports
│   ├── PDF certificates
│   ├── Readiness scores
│   └── Deployment recommendations
│
├── Notification Center
│   ├── Attempted notifications
│   ├── Delivered notifications
│   ├── Failed notifications
│   ├── Muted/skipped notifications
│   └── Provider diagnostics
│
├── Admin
│   ├── Users
│   ├── Roles
│   ├── Departments
│   ├── Product scopes
│   ├── Tenant scopes
│   └── Audit logs
│
└── Mobile Companion
    ├── Queue monitoring
    ├── Push notifications
    ├── Deep links
    ├── Takeover
    ├── Replies
    ├── Notes
    ├── Lead/inquiry capture
    └── Availability
```

---

## 4. Implementation Principles

### 4.1 Backend Authority

The frontend must never be treated as the enforcement layer. The backend must enforce authentication, active support-user records, roles, product scopes, tenant scopes, department scopes, state transitions, takeover-before-reply, required lead/inquiry data before close, and audit logging.

Frontend guards are usability aids only.

### 4.2 Product-Aware Operations

Every support session must include product context: `productId`, `productName`, `tenantId` when applicable, customer/user identity when available, subscription state when available, latest release/build when available, and latest product health state.

### 4.3 AI First, Human Ready

The smart support widget should attempt to answer or resolve common issues first. When escalation is needed, it should pass a structured handoff to WSC containing the question, product, user/session context, attempted answer, confidence score, suspected category, recent relevant product events, and recommended next action.

### 4.4 Safe Diagnostics

Diagnostics should be available only to authorized support admins. Do not expose secrets, raw tokens, private claims, stack traces, payment details, sensitive transcript content in notifications, or provider credentials.

### 4.5 Release-Aware Support

WSC should be able to answer what version the customer is on, whether the latest release passed certification, whether Stripe/Auth/Meta/Email passed, whether there are known incidents, and whether the customer is affected.

---

## 5. Phase Plan

## Phase 1 — Stabilize Production Safety

### Goal

Make the existing support console safe enough to operate during SageSet, Merxus, and RadiusIQ launches.

### 1.1 Backend Enforcement Verification

Create backend contract/integration tests that prove:

- Every `/support/*` route validates Firebase tokens.
- Active support-user record is required.
- Disabled support users are rejected.
- Role scopes are enforced.
- Product scopes are enforced.
- Tenant scopes are enforced.
- Department scopes are enforced.
- Viewer cannot perform write actions.
- Reply before takeover is rejected.
- Takeover outside valid state is rejected.
- Transfer outside valid state is rejected.
- Close without required lead/inquiry data is rejected.
- Blocked attempts create audit logs.
- Successful protected actions create audit logs.

Deliverables:

```text
docs/backend-enforcement-verification.md
tests/contracts/support-auth-scope.test.*
tests/contracts/support-state-transitions.test.*
tests/contracts/support-audit-log.test.*
```

Acceptance criteria:

- Backend enforcement test plan exists.
- Each protected behavior has a documented expected result.
- Any unverified backend behavior is listed as a blocker or risk acceptance.

### 1.2 Support Lifecycle Contract Tests

Add deployed contract tests for the complete lifecycle:

1. Public widget creates session.
2. AI escalates or transfer is requested.
3. Session appears in WSC.
4. Agent accepts takeover.
5. Customer-visible history is preserved.
6. Agent reply reaches customer.
7. Lead and inquiry data are saved consistently.
8. Close succeeds only when backend rules permit it.
9. Transcript sending works.
10. Audit timeline records key events.

Deliverables:

```text
tests/playwright/support-lifecycle.spec.js
tests/playwright/support-failure-paths.spec.js
docs/support-lifecycle-contract.md
```

Acceptance criteria:

- Happy path lifecycle passes against a safe test/staging environment.
- Failure path tests exist for required backend codes.
- Tests do not create uncontrolled production data.

### 1.3 Dependency and Security Remediation

Remediate or formally risk-accept current audit findings.

Root app areas include `axios`, `react-router-dom`, `react-router`, `firebase-admin` transitive advisories, `protobufjs`, and `@grpc/grpc-js`.

Mobile areas include `shell-quote`, `undici`, `ws`, Expo/React Native transitive advisories, and protobuf/grpc advisories.

Deliverables:

```text
docs/security-audit-remediation.md
docs/security-risk-acceptance.md
```

Acceptance criteria:

- `npm audit --omit=dev` reviewed at root.
- `npm audit --omit=dev` reviewed for mobile.
- High/critical advisories fixed or explicitly risk-accepted.
- Release certification includes audit status.

### 1.4 Debug Keystore Hygiene

Address tracked debug keystore:

```text
mobile-support-app/android/app/debug.keystore
```

Actions:

- Decide whether to remove from git.
- If retained, document why.
- Ensure production signing keys are never committed.
- Update `.gitignore`.

Deliverables:

```text
docs/mobile-signing-boundaries.md
```

### 1.5 Mobile Token Security

Replace sensitive token storage in AsyncStorage.

Actions:

- Use Expo SecureStore for fallback bearer tokens and auth-sensitive values.
- Keep AsyncStorage for non-sensitive preferences only.
- Add migration/cleanup from old AsyncStorage keys.

Deliverables:

```text
mobile-support-app/src/services/secureTokenStorage.ts
docs/mobile-auth-security.md
```

Acceptance criteria:

- Tokens are stored in SecureStore.
- AsyncStorage no longer stores bearer tokens.
- Logout clears SecureStore and non-sensitive preferences appropriately.

---

## Phase 2 — Product Health and Release Certification Integration

### Goal

Make WSC aware of the operational health of every Workside product.

### 2.1 Product Health Dashboard

Add a dashboard showing:

```text
Product | Status | Latest Release | QA | Meta | Stripe | Auth | Email | Notifications
```

Products:

- SageSet
- Merxus AI
- RadiusIQ
- Workside Support Console

Statuses:

- Healthy
- Warning
- Degraded
- Incident
- Unknown

Data sources:

- Latest release certification reports
- API health endpoints
- Stripe test status
- Meta verification status
- notification health
- Firebase/auth health
- SendGrid/email status

Deliverables:

```text
src/render/productHealthDashboard.js
src/services/productHealth.js
docs/product-health-dashboard.md
```

Acceptance criteria:

- Dashboard displays all active products.
- Each product has latest known status.
- Unknown state is explicit, not hidden.
- Product row links to latest release report.

### 2.2 Release Certification Archive

Integrate the release certification framework into WSC.

WSC should read archived reports from a consistent location or API.

Report artifacts:

- HTML report
- JSON report
- PDF certificate
- screenshots
- Lighthouse summary
- deployment recommendation
- readiness score

Suggested archive structure:

```text
release-archive/
  SageSet/
    2026-06-27/
      release-report.html
      release-report.json
      release-certificate.pdf
  Merxus/
  RadiusIQ/
  SupportConsole/
```

Deliverables:

```text
src/services/releaseArchive.js
src/render/releaseArchiveView.js
docs/release-archive-integration.md
```

Acceptance criteria:

- WSC displays latest report per product.
- WSC can open archived historical reports.
- WSC shows readiness score and deployment recommendation.
- Missing archive data shows as Unknown/Not Available.

### 2.3 Support Context from Release Data

When a support session is selected, show product, current app version/build if known, latest release certification status, latest known incident status, recent failed checks, and known warnings.

Deliverables:

```text
src/render/sessionProductContext.js
src/services/sessionDiagnostics.js
```

Acceptance criteria:

- Agent can see whether the product is currently healthy.
- Agent can tell whether latest release passed.
- Agent can see whether the issue may relate to a known degraded system.

---

## Phase 3 — Notification Observability

### Goal

Make support notifications reliable, visible, and diagnosable.

### 3.1 Notification Receipt Model

Backend should persist notification receipts with notification id, session id, product, channel, provider, recipient id, attempted timestamp, delivery status, provider response, error/skipped reason, muted state, and retry count.

Frontend should display receipts in session detail.

Deliverables:

```text
docs/notification-receipts-contract.md
src/render/notificationTimeline.js
src/services/notifications.js
```

Acceptance criteria:

- Session detail shows notification timeline.
- Failed notifications are visible.
- Muted/skipped notifications are distinguishable.
- No sensitive transcript content is exposed.

### 3.2 Mobile Push Token Registration

Implement mobile push token registration.

Actions:

- Acquire Expo push token.
- Register token with backend.
- Include device id/platform/app version.
- Support token update.
- Support token revoke on logout.
- Avoid duplicate active tokens.

Deliverables:

```text
mobile-support-app/src/services/pushRegistration.ts
docs/mobile-push-registration.md
```

Acceptance criteria:

- Token is registered after login.
- Token is revoked or disabled on logout.
- Backend can target support users/devices.
- Push payload avoids sensitive content.

### 3.3 Mobile Deep Linking

Implement push notification deep links to session detail.

Actions:

- Define push payload shape.
- Add Expo Router deep link handling.
- Open correct session when notification tapped.
- Handle session not found/permission denied gracefully.

Deliverables:

```text
mobile-support-app/src/services/deepLinks.ts
docs/mobile-push-deeplinks.md
```

---

## Phase 4 — AI Support Layer and Knowledge Base

### Goal

Let Workside apps answer more questions automatically before human escalation.

### 4.1 Knowledge Base Foundation

Create a product-aware knowledge base model with product, category, question, answer, tags, audience, status, last reviewed, owner, related release/version, and source links.

Deliverables:

```text
docs/knowledge-base-model.md
src/services/knowledgeBase.js
src/render/knowledgeBaseAdmin.js
```

Acceptance criteria:

- Admin can create/edit/publish KB articles.
- Articles are product-scoped.
- Internal articles are not exposed to public widget.
- KB supports search/filtering.

### 4.2 Smart Widget Handoff Contract

Define the support widget handoff payload.

Required fields:

```json
{
  "product": "SageSet",
  "sessionId": "...",
  "userId": "...",
  "tenantId": "...",
  "question": "...",
  "aiAnswerAttempted": true,
  "aiAnswer": "...",
  "confidence": 0.72,
  "category": "billing",
  "recommendedAction": "human_takeover",
  "recentEvents": [],
  "diagnostics": {}
}
```

Deliverables:

```text
docs/smart-widget-handoff-contract.md
src/services/aiHandoff.js
src/render/aiHandoffSummary.js
```

Acceptance criteria:

- Agent sees AI summary before replying.
- Agent sees confidence and category.
- Agent sees prior attempted answers.
- Handoff does not expose secrets or raw tokens.

### 4.3 Suggested Agent Replies

Add suggested replies based on customer question, product, KB articles, previous AI answer, session context, and release/health status.

Deliverables:

```text
src/services/suggestedReplies.js
src/render/suggestedRepliesPanel.js
```

Acceptance criteria:

- Suggestions are clearly labeled as AI-generated.
- Agent must approve before sending.
- Suggestions include source/context when possible.

---

## Phase 5 — Customer Timeline and Product Context

### Goal

Give support agents a complete view of the customer relationship.

### 5.1 Customer Timeline

For each customer/session, show conversations, tickets, support notes, lead/demo history, subscription events, product events, release exposure, and important account changes.

Deliverables:

```text
src/services/customerTimeline.js
src/render/customerTimeline.js
docs/customer-timeline-contract.md
```

Acceptance criteria:

- Timeline is product-scoped.
- Sensitive fields are redacted.
- Events are chronological.
- Agent can filter by event type.

### 5.2 Billing Context

Show safe Stripe/subscription context: plan, trial status, subscription status, renewal date, last payment status, failed payment indicator, and cancellation state.

Do not expose full payment details.

Deliverables:

```text
src/services/billingContext.js
src/render/billingContextPanel.js
docs/billing-context-contract.md
```

Acceptance criteria:

- Agent can answer common billing questions.
- No card data is exposed.
- Billing data is read-only unless explicit admin actions are later implemented.

---

## Phase 6 — Mobile Feature Parity

### Goal

Make the mobile app suitable for real field support.

### 6.1 Product Scope and Assigned Sessions

Replace hard-coded Merxus filtering.

Actions:

- Load allowed products from backend.
- Support product selector or all-allowed queue.
- Add assigned-to-me query.
- Fetch escalated/active human sessions assigned to current agent.

Deliverables:

```text
mobile-support-app/src/services/supportScope.ts
mobile-support-app/app/dashboard.tsx
```

Acceptance criteria:

- Mobile supports SageSet, Merxus, RadiusIQ.
- Agent sees assigned sessions.
- Agent does not see unauthorized products.

### 6.2 Mobile Internal Notes

Add internal note support.

Deliverables:

```text
mobile-support-app/src/components/InternalNotes.tsx
mobile-support-app/src/services/notes.ts
```

### 6.3 Mobile Lead and Inquiry Capture

Add mobile forms for lead capture, inquiry capture, and close-required data.

Deliverables:

```text
mobile-support-app/src/components/LeadCaptureForm.tsx
mobile-support-app/src/components/InquiryCaptureForm.tsx
```

### 6.4 Full Availability Statuses

Support available, away, busy, offline, and do-not-disturb.

Deliverables:

```text
mobile-support-app/src/components/AvailabilitySelector.tsx
```

---

## Phase 7 — Web Maintainability

### Goal

Reduce the risk of `src/main.js` becoming a long-term bottleneck.

### 7.1 Split Main Entry

Extract from `src/main.js` into modules:

```text
src/controllers/authController.js
src/controllers/sessionController.js
src/controllers/adminController.js
src/controllers/availabilityController.js
src/controllers/pollingController.js
src/controllers/transcriptController.js
src/controllers/assignmentController.js
src/controllers/diagnosticsController.js
src/render/appShell.js
src/render/sessionDetail.js
src/render/sessionList.js
```

Acceptance criteria:

- `src/main.js` becomes orchestration only.
- Existing tests pass.
- Build passes.
- No behavior regression.

### 7.2 Canonical Contract Normalization

Keep compatibility fallbacks during integration, but document and eventually remove them.

Actions:

- Identify all response aliases.
- Document canonical backend shape.
- Add warnings when fallback shapes are used.
- Remove stale fallbacks after backend stabilizes.

Deliverables:

```text
docs/backend-response-canonicalization.md
src/services/contractWarnings.js
```

---

## Phase 8 — Metrics, Queues, and Operational Views

### Goal

Turn WSC into an operational dashboard, not just a session list.

### 8.1 Dedicated Queues

Add views for active conversations, waiting transfers, assigned to me, leads requiring follow-up, inquiries requiring response, closed today, stale sessions, and failed close attempts.

Deliverables:

```text
src/render/queueViews.js
src/services/queueMetrics.js
```

### 8.2 SLA and Aging Indicators

Add time since created, time waiting for human, time since last customer message, time since last agent response, and SLA status.

Deliverables:

```text
src/render/slaIndicators.js
```

### 8.3 Admin Coverage View

Show agents available by product, department, heartbeat freshness, muted notifications, stale availability, and unassigned waiting sessions.

Deliverables:

```text
src/render/adminCoverageView.js
```

---

## Phase 9 — Testing and Release Certification

### Goal

Make WSC itself subject to the same release standards as SageSet, Merxus, and RadiusIQ.

### 9.1 Web Playwright Tests

Add tests for login, queue loading, session selection, transfer request, takeover, reply, internal note, transcript send, lead-required close, inquiry-required close, no-follow-up close, diagnostics visibility, admin role access, and viewer read-only behavior.

Deliverables:

```text
tests/playwright/web-support-console.spec.js
tests/playwright/web-failure-paths.spec.js
```

### 9.2 Mobile Tests

Add mobile test coverage where practical:

- auth
- dashboard filters
- session detail
- availability
- secure token storage
- push token registration
- deep link handling

Deliverables:

```text
mobile-support-app/tests/*
```

### 9.3 Release Certification Artifacts

Integrate WSC with the Workside Release Certification framework.

WSC release report should include readiness score, blocking/warning/skipped classification, deployment recommendation, audit status, mobile typecheck, web build, Playwright results, mobile tests, PDF certificate, and archived reports.

Acceptance criteria:

- `npm run verify:release` works.
- HTML/JSON/PDF reports generated.
- Reports archived.
- WSC appears in the operational product health dashboard.

---

## 10. Data Contracts to Create or Update

Create or update:

```text
docs/backend-enforcement-verification.md
docs/support-lifecycle-contract.md
docs/notification-receipts-contract.md
docs/mobile-push-registration.md
docs/mobile-push-deeplinks.md
docs/knowledge-base-model.md
docs/smart-widget-handoff-contract.md
docs/customer-timeline-contract.md
docs/billing-context-contract.md
docs/product-health-dashboard.md
docs/release-archive-integration.md
docs/backend-response-canonicalization.md
docs/mobile-auth-security.md
docs/security-audit-remediation.md
```

---

## 11. Suggested API Endpoints

If backend changes are required, use this as a proposed contract.

```http
GET /support/me
GET /support/products/health
GET /support/products/:productId/releases/latest
GET /support/products/:productId/releases
GET /support/products/:productId/releases/:releaseId
GET /support/sessions/:sessionId/notifications
GET /support/customers/:customerId/timeline?productId=...
GET /support/customers/:customerId/billing-context?productId=...
GET /support/kb?productId=...
POST /support/kb
PATCH /support/kb/:articleId
POST /support/kb/:articleId/publish
POST /support/kb/:articleId/archive
POST /support/mobile/push-tokens
DELETE /support/mobile/push-tokens/:tokenId
```

`GET /support/me` should return:

```json
{
  "userId": "string",
  "email": "string",
  "displayName": "string",
  "roles": ["support_agent"],
  "products": ["sageset", "merxus", "radiusiq"],
  "departments": ["general"],
  "tenants": [],
  "status": "active"
}
```

---

## 12. Prioritized Sprint Breakdown

### Sprint 1 — Production Safety and Proof

- Backend enforcement verification docs/tests
- Support lifecycle deployed contract tests
- Dependency audit remediation/risk acceptance
- Mobile SecureStore token migration
- Debug keystore decision
- Notification receipt contract

### Sprint 2 — Operational Platform Foundation

- Product Health Dashboard
- Release Certification Archive integration
- Session product health context
- Notification timeline in session detail
- Push token registration
- Mobile deep links

### Sprint 3 — AI Support and Knowledge Base

- Knowledge base model/admin UI
- Smart widget handoff contract
- AI handoff summary panel
- Suggested replies
- Product-aware escalation categories

### Sprint 4 — Mobile Production Readiness

- Product scope removal of hard-coded Merxus
- Assigned-to-me queues
- Internal notes
- Lead/inquiry capture
- Full availability statuses
- Secure push/deep link behavior

### Sprint 5 — Maintainability and Scale

- Split `src/main.js`
- Canonical backend response contracts
- Dedicated queues
- SLA indicators
- Admin coverage view
- Web/mobile test expansion
- Full release certification artifacts

---

## 13. Acceptance Criteria for Next-Level WSC

The initiative is complete when:

1. WSC supports SageSet, Merxus, and RadiusIQ as first-class products.
2. Backend enforcement is proven or clearly documented as pending.
3. Agents can see product health and latest release certification from support sessions.
4. Notification receipts are visible and diagnosable.
5. Mobile tokens are secure and push registration works.
6. Mobile can open session detail from push notification.
7. AI handoff summaries are visible to agents.
8. KB articles can drive support answers.
9. Customer timeline shows support, billing, and product events safely.
10. WSC itself has release certification artifacts.
11. Dependency audit issues are remediated or risk-accepted.
12. `src/main.js` is reduced to orchestration.
13. Release reports and certificates are archived and visible from WSC.
14. The app is ready to support SageSet launch first, then Merxus, then RadiusIQ.

---

## 14. Non-Goals for This Phase

Do not implement the following unless explicitly approved:

- Full external customer-facing ticket portal
- Public community forum
- AI auto-refunds
- AI account deletion
- AI billing changes without human approval
- Real-time WebSocket rewrite unless polling becomes a demonstrated bottleneck
- Multi-company white-label support console
- Full CRM replacement

---

## 15. Final Codex Instruction

Implement this plan incrementally and safely.

Start with production safety, backend authority proof, notification observability, and product health/release certification integration.

Do not add large amounts of UI without proving enforcement and contracts.

Prefer small, testable, documented changes.

Every phase must:

- pass existing tests
- pass build
- update documentation
- avoid exposing secrets
- avoid creating uncontrolled production data
- preserve current support workflows
- improve the platform without breaking launch readiness for SageSet, Merxus, or RadiusIQ

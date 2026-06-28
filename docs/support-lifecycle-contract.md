# Support Lifecycle Contract

Date: 2026-06-28

## Goal

Prove the complete customer-to-agent lifecycle without creating uncontrolled production data.

## Canonical Lifecycle

1. Public widget creates a support session.
2. AI handles the session in `active_ai`.
3. Transfer is requested because the visitor asks for a person, confidence is low, urgency is high, or an operator manually escalates.
4. Session appears in Workside Support Console as `escalated`.
5. Agent accepts takeover.
6. Backend transitions session to `active_human`.
7. Agent reply is accepted only after takeover.
8. Lead identity is captured when required.
9. Inquiry details are captured when required.
10. Transcript can be sent with safe defaults.
11. Close succeeds only when backend policy allows it.
12. Audit timeline records protected actions and blocked attempts.

## Safe Test Environment Requirements

- Dedicated staging API base URL.
- Dedicated public widget test tenant.
- Dedicated support users with roles: `super_admin`, `support_agent`, `viewer`, unauthorized Firebase user.
- Test data cleanup strategy.
- Outbound notification sandbox or deterministic provider stubs.

## Required Success Assertions

- Session list returns the new session within one polling interval.
- Detail route returns ordered messages before and after takeover.
- Takeover does not clear customer-visible history.
- Reply route persists an agent message and customer widget receives it.
- Lead write is visible immediately in detail and list read models.
- Inquiry write is visible immediately in detail and list read models.
- Close returns a refreshed closed session or detail route confirms closed status.
- Transcript request records a receipt and excludes internal notes by default.

## Required Failure Assertions

- Missing token cannot list sessions.
- Viewer cannot mutate sessions.
- Unauthorized product/tenant filters are rejected.
- Reply before takeover is rejected.
- Takeover outside `escalated` is rejected.
- Close without required lead is rejected.
- Close without required inquiry is rejected.
- Closed sessions cannot be transferred or replied to.

## Frontend Test Files

This repository includes Playwright tests for live/safe environments. They must remain opt-in and credential-gated.

- `tests/support-flow.spec.js`
- `tests/support-failures.spec.js`
- `tests/support-edge-cases.spec.js`
- `tests/playwright/support-lifecycle.spec.js`
- `tests/playwright/support-failure-paths.spec.js`

## Non-Negotiable Production Rule

The frontend may display warnings or disable buttons, but production readiness depends on backend rejection of invalid direct API calls.

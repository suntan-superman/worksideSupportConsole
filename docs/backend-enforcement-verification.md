# Backend Enforcement Verification

Date: 2026-06-28

## Purpose

This document defines the backend proof required before the Workside Support Console can be treated as production-safe. Frontend guards are usability only. The backend must be the final authority for identity, scope, state transitions, data capture requirements, and audit logging.

## Routes In Scope

- `GET /support/me`
- `GET /support/products`
- `GET /support/tenants`
- `GET /support/sessions`
- `GET /support/sessions/:sessionId`
- `POST /support/sessions/:sessionId/request-transfer`
- `POST /support/sessions/:sessionId/takeover`
- `POST /support/sessions/:sessionId/reply`
- `POST /support/sessions/:sessionId/close`
- `PATCH /support/sessions/:sessionId/lead`
- `POST /support/sessions/:sessionId/inquiry`
- `POST /support/sessions/:sessionId/notes`
- `POST /support/sessions/:sessionId/transcript`
- `POST /support/sessions/:sessionId/assign`
- `/support/admin/*`
- `/support/users/me/availability`
- `/support/users/me/heartbeat`
- `/support/mobile/push-tokens`

## Required Test Matrix

| Behavior | Expected Result | Audit Required |
| --- | --- | --- |
| Missing bearer token on support route | `401 AUTH_REQUIRED` | No |
| Invalid/expired bearer token | `401 INVALID_AUTH_TOKEN` | No |
| Valid Firebase user without active support user record | `403 SUPPORT_CONSOLE_ACCESS_DENIED` | Yes |
| Disabled support user | `403 SUPPORT_USER_INACTIVE` | Yes |
| User reads unauthorized product | `403 PRODUCT_ACCESS_DENIED` | Yes |
| User reads unauthorized tenant | `403 TENANT_ACCESS_DENIED` | Yes |
| Viewer performs write action | `403 ROLE_ACCESS_DENIED` | Yes |
| Agent writes outside department scope | `403 DEPARTMENT_ACCESS_DENIED` | Yes |
| Reply before takeover | `409 INVALID_SESSION_STATE` or `TRANSFER_NOT_ACCEPTED` | Yes |
| Takeover when not escalated | `409 INVALID_SESSION_STATE` | Yes |
| Transfer from closed session | `409 INVALID_SESSION_STATE` | Yes |
| Close without required lead | `422 LEAD_CAPTURE_REQUIRED` | Yes |
| Close without required inquiry | `422 INQUIRY_CAPTURE_REQUIRED` | Yes |
| Successful transfer request | `200`, session becomes `escalated` | Yes |
| Successful takeover | `200`, session becomes `active_human` | Yes |
| Successful reply | `200`, agent message persisted | Yes |
| Successful close | `200`, session becomes `closed` | Yes |
| Admin user update by non-admin | `403 ROLE_ACCESS_DENIED` | Yes |
| Admin user update by super admin | `200`, support user updated | Yes |

## Expected Structured Error Shape

```json
{
  "ok": false,
  "error": {
    "code": "LEAD_CAPTURE_REQUIRED",
    "message": "Lead capture is required before this action can be completed.",
    "requiredAction": "collect_lead",
    "missingFields": ["name", "email"],
    "sessionId": "sess_123"
  }
}
```

## Audit Event Minimum Fields

```json
{
  "id": "audit_123",
  "actorUserId": "support_user_id",
  "actorEmail": "agent@example.com",
  "action": "support.session.reply.blocked",
  "resourceType": "support_session",
  "resourceId": "sess_123",
  "product": "merxus",
  "tenantId": "tenant_123",
  "outcome": "blocked",
  "reason": "INVALID_SESSION_STATE",
  "createdAt": "2026-06-28T00:00:00.000Z"
}
```

## Contract Test Deliverables

The backend repository should own executable tests. This repository owns the frontend-facing contract and Playwright smoke tests.

Recommended backend test files:

- `tests/contracts/support-auth-scope.test.*`
- `tests/contracts/support-state-transitions.test.*`
- `tests/contracts/support-audit-log.test.*`

## Current Status

Blocked until a safe staging backend and test credentials are available. Risk is not accepted for production until every required behavior is either passing in backend tests or explicitly risk-accepted by product/security ownership.

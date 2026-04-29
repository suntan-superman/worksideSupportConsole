# Backend Support Error/Status Contract Review

Reviewed backend path, read-only:

`C:\Users\sjroy\Source\Merxus\merxus-ai-backend`

Date: 2026-04-29

## Summary

The backend now returns the most important capture enforcement codes correctly:

- `LEAD_CAPTURE_REQUIRED`
- `INQUIRY_CAPTURE_REQUIRED`
- `ANONYMOUS_CLOSE_NOT_ALLOWED`

The remaining alignment work is mostly about consistency:

1. Use canonical uppercase error codes across all support routes.
2. Include `requiredAction`, `sessionId`, and related details for expected workflow blocks.
3. Return canonical frontend session statuses, not only internal `transferState`.
4. Add/adjust tests to assert exact HTTP payloads, not only thrown service errors.

## Current Good Behavior

### Lead Capture

`src/modules/support/enforcement/captureEnforcement.js`

`requireLead()` now throws:

```json
{
  "code": "LEAD_CAPTURE_REQUIRED",
  "details": {
    "requiredAction": "collect_lead",
    "missingFields": ["name", "email"],
    "sessionId": "..."
  }
}
```

This aligns well with the Support Console.

### Inquiry Capture

`requireInquiry()` now throws:

```json
{
  "code": "INQUIRY_CAPTURE_REQUIRED",
  "details": {
    "requiredAction": "collect_inquiry",
    "sessionId": "..."
  }
}
```

This also aligns well.

### No Follow-up Close

`src/modules/support/services/supportSessionService.js`

`anonymous_no_follow_up` correctly bypasses lead/inquiry requirements only when tenant policy allows it. When policy blocks it, the backend returns `ANONYMOUS_CLOSE_NOT_ALLOWED` with `requiredAction: "contact_admin"`.

## Recommended Changes

### 1. Return Canonical Session Statuses

Current issue:

`mapSessionSummary()` returns both `transferState` and `status`, but `status` is currently only `"open"` or `"closed"` via `getSessionStatus()`.

For the frontend, `status` should be one of:

```ts
type SupportSessionStatus =
  | "active_ai"
  | "escalated"
  | "active_human"
  | "closed";
```

Recommended mapping:

```js
function getSessionStatus(session = {}) {
  const transferState = inferSupportTransferState(session);

  if (transferState === SUPPORT_TRANSFER_STATES.CLOSED) return "closed";
  if (
    transferState === SUPPORT_TRANSFER_STATES.TRANSFER_REQUESTED ||
    transferState === SUPPORT_TRANSFER_STATES.TRANSFER_INITIATED ||
    transferState === SUPPORT_TRANSFER_STATES.TRANSFER_FAILED
  ) {
    return "escalated";
  }
  if (transferState === SUPPORT_TRANSFER_STATES.HUMAN_TAKEOVER) return "active_human";

  return "active_ai";
}
```

Why this matters:

- `Request Transfer` should move the UI to `escalated`.
- `Accept Transfer` should move the UI to `active_human`.
- The reply composer should only enable when `active_human`.

The backend can still return `transferState` for diagnostics, but `status` should be the stable UI-facing state.

### 2. Canonicalize Error Codes

Several support errors still use lowercase or generic codes:

- `unauthorized`
- `auth_unavailable`
- `database_unavailable`
- `forbidden`
- `invalid_transfer_state_transition`
- `takeover_required_for_reply`
- `missing_reply_message`
- `missing_session_id`
- `support_session_not_found`
- `missing_lead_payload`
- `missing_inquiry_payload`
- `invalid_input`

Recommended support API codes:

```ts
type SupportErrorCode =
  | "AUTH_REQUIRED"
  | "INVALID_AUTH_TOKEN"
  | "AUTH_UNAVAILABLE"
  | "DATABASE_UNAVAILABLE"
  | "ROLE_REQUIRED"
  | "FORBIDDEN"
  | "FILTER_ACCESS_DENIED"
  | "TENANT_REQUIRED_FOR_ACTION"
  | "SESSION_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "LEAD_CAPTURE_REQUIRED"
  | "INQUIRY_CAPTURE_REQUIRED"
  | "ANONYMOUS_CLOSE_NOT_ALLOWED"
  | "INVALID_SESSION_STATE"
  | "TRANSFER_NOT_REQUESTED"
  | "REPLY_NOT_ALLOWED";
```

At minimum, normalize these high-impact codes:

| Current code | Recommended code |
| --- | --- |
| `unauthorized` | `AUTH_REQUIRED` or `INVALID_AUTH_TOKEN` |
| `auth_unavailable` | `AUTH_UNAVAILABLE` |
| `database_unavailable` | `DATABASE_UNAVAILABLE` |
| `forbidden` | `FORBIDDEN` |
| `invalid_transfer_state_transition` | `INVALID_SESSION_STATE` |
| `takeover_required_for_reply` | `REPLY_NOT_ALLOWED` |
| `missing_reply_message` | `VALIDATION_ERROR` |
| `missing_session_id` | `VALIDATION_ERROR` |
| `support_session_not_found` | `SESSION_NOT_FOUND` |
| `missing_lead_payload` | `VALIDATION_ERROR` |
| `missing_inquiry_payload` | `VALIDATION_ERROR` |
| `invalid_input` | `VALIDATION_ERROR` |

The frontend normalizes many cases defensively, but canonical backend codes reduce ambiguity and make diagnostics cleaner.

### 3. Standardize Error Payload Shape

Current payload shape:

```json
{
  "error": "message",
  "code": "CODE",
  "details": {}
}
```

The frontend supports this. However, the preferred support contract is:

```json
{
  "ok": false,
  "error": {
    "code": "CODE",
    "message": "Human-readable message",
    "requiredAction": "collect_inquiry",
    "missingFields": [],
    "sessionId": "..."
  }
}
```

Recommended transitional response:

```json
{
  "ok": false,
  "error": "Human-readable message",
  "code": "CODE",
  "requiredAction": "collect_inquiry",
  "missingFields": [],
  "sessionId": "...",
  "details": {
    "requiredAction": "collect_inquiry",
    "missingFields": [],
    "sessionId": "..."
  }
}
```

This preserves current frontend compatibility while moving toward a cleaner contract.

Suggested `toSupportErrorPayload()` enhancement:

```js
export function toSupportErrorPayload(error, fallbackMessage = "Support request failed") {
  const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
  const message = error?.message || fallbackMessage;
  const details = error?.details || {};
  const code = normalizeSupportErrorCode(error?.code);

  return {
    status,
    payload: {
      ok: false,
      error: message,
      code,
      requiredAction: details.requiredAction,
      missingFields: details.missingFields,
      sessionId: details.sessionId,
      details,
    },
  };
}
```

### 4. Add Required Actions to State Errors

For invalid state/action errors, include `requiredAction: "refresh_session"` where appropriate.

Examples:

```json
{
  "code": "INVALID_SESSION_STATE",
  "requiredAction": "refresh_session",
  "details": {
    "fromState": "closed",
    "toState": "human_takeover",
    "action": "takeover"
  }
}
```

For reply before takeover:

```json
{
  "code": "REPLY_NOT_ALLOWED",
  "requiredAction": "refresh_session",
  "details": {
    "transferState": "transfer_requested"
  }
}
```

### 5. Revisit Request Transfer Inquiry Enforcement

Current behavior:

`requestSupportTransfer()` always calls `requireInquiry()` after optionally accepting inline `body.inquiry`.

If the business rule is “no transfer without inquiry,” keep this. If inquiry is only required for after-hours or follow-up scenarios, make it conditional like close:

```js
if (resolveRequiresInquiryCapture(current)) {
  requireInquiry(inquirySessionView, { action: "request_transfer" });
}
```

Either rule is valid, but it must be explicit and reflected in `requiresInquiryCapture` returned by session detail/list. The frontend disables `Request Transfer` preemptively only when it knows `requiresInquiryCapture === true`.

### 6. Return Policy Flags on List and Detail

The backend now appears to return:

- `requiresInquiryCapture`
- `allowAnonymousNoFollowUpClose`

Keep these stable on both:

- `GET /support/sessions`
- `GET /support/sessions/:id`

The frontend uses those flags to avoid sending doomed requests.

### 7. Tests to Add or Strengthen

Service-level tests exist and are useful. Add route/payload-level tests for exact HTTP responses.

Recommended cases:

- `POST /support/sessions/:id/close` missing lead returns status `422`, code `LEAD_CAPTURE_REQUIRED`, `requiredAction: collect_lead`, `missingFields`, `sessionId`.
- `POST /support/sessions/:id/close` missing required inquiry returns status `422`, code `INQUIRY_CAPTURE_REQUIRED`, `requiredAction: collect_inquiry`, `sessionId`.
- `POST /support/sessions/:id/request-transfer` missing required inquiry returns status `422`, code `INQUIRY_CAPTURE_REQUIRED`.
- `POST /support/sessions/:id/takeover` from closed/invalid state returns `409`, code `INVALID_SESSION_STATE`.
- `POST /support/sessions/:id/reply` before takeover returns `409`, code `REPLY_NOT_ALLOWED`.
- Auth failure returns `401`, code `AUTH_REQUIRED` or `INVALID_AUTH_TOKEN`.
- Read-only viewer write attempt returns `403`, code `FORBIDDEN` or `ROLE_REQUIRED`.
- `GET /support/sessions/:id` after request transfer returns `status: "escalated"`.
- `GET /support/sessions/:id` after takeover returns `status: "active_human"`.

## Priority

1. **P0:** Return canonical `status` values from `mapSessionSummary()`.
2. **P0:** Normalize state/action error codes to `INVALID_SESSION_STATE`, `REPLY_NOT_ALLOWED`, and `VALIDATION_ERROR`.
3. **P1:** Add `requiredAction` passthrough to top-level error payloads.
4. **P1:** Add route-level tests for exact JSON payloads.
5. **P2:** Move fully to nested `{ ok: false, error: { ... } }` once all clients are ready.


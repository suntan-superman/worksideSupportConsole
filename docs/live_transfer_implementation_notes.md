# Live Transfer Implementation Notes

Updated: April 27, 2026 (America/Los_Angeles)

## Current Integration Mode

The frontend is now locked to canonical backend support routes under `/support`.
Fallback endpoint guessing has been removed.

Canonical routes used:

- `GET /support/sessions`
- `GET /support/sessions/:sessionId`
- `POST /support/sessions/:sessionId/request-transfer`
- `POST /support/sessions/:sessionId/takeover`
- `POST /support/sessions/:sessionId/reply`
- `POST /support/sessions/:sessionId/close`
- `PATCH /support/sessions/:sessionId/lead`
- `POST /support/sessions/:sessionId/inquiry`

## Scope Implemented

- Transfer queue + prioritized session list
- Session detail + conversation transcript
- Manual transfer request (reason + note)
- Human takeover action
- Human reply composer
- Lead capture form + save action
- Inquiry intake form + save action
- Lead/inquiry UI enforcement before close
- Realtime socket client (`/support/realtime`) with polling fallback
- Structured backend error mapping:
  - parses `error.code`, `requiredAction`, `missingFields`
  - focuses lead/inquiry forms when backend requires those actions
  - refreshes session on invalid-state/refresh-required errors
  - auth warning UX for `AUTH_REQUIRED` / `INVALID_AUTH_TOKEN`
- API diagnostics panel with endpoint/method + error code + required action
- Firebase token propagation on API requests when available
- Frontend auth/setup gate:
  - token login flow (token + tenant + product)
  - optional Firebase email/password login when Firebase env vars are configured
  - protected startup so polling/realtime/API load only after authentication

## Important Boundary

This repository is frontend-only.
Backend-authoritative enforcement from `docs/workside_backend_enforcement_layer.md` (auth middleware, RBAC, transition enforcement, server-side lead/inquiry enforcement, audit logging) must be implemented and maintained in the backend chat-engine repository.

## Open Integration Risks

1. If backend payload shapes differ from expected canonical contract, UI normalization may need updates.
2. Firebase login requires valid Firebase env config in this frontend app and valid backend auth claims.
3. Contract-level integration tests are still needed for production confidence.

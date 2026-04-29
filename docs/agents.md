
# Workside System Overview

## Architecture
- Multi-tenant Workside conversational support platform.
- Frontend in this repository: Vite-powered support console using vanilla JavaScript modules and CSS.
- Backend dependency: shared chat engine API, expected to be Node + MongoDB with Firebase authentication and custom claims.
- Auth: Firebase ID tokens are sent as `Authorization: Bearer <token>`; local token fallback is supported for integration work.

## Support Flow
AI -> transfer requested -> human takeover -> lead capture -> inquiry capture when required -> close.

## Core Rules
- No agent reply before human takeover.
- No close when required lead identity is missing.
- No after-hours/no-human close when inquiry details are missing.
- No transfer or takeover outside the valid session state machine.
- No cross-product or cross-tenant access; backend is the final authority.

## Current Frontend Surface
- Entry point: `src/main.js`.
- API transport and structured error parsing: `src/services/api.js`.
- Support API client and response normalization: `src/services/chat.js`.
- Chat error mapping helpers: `src/services/chatErrors.js`.
- Firebase auth bridge: `src/services/auth.js`.
- Styling: `src/style.css`.

## Canonical Support Routes
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

## Engineering Workflow
Use the loop from `docs/codex_workflow_system.md`:

1. Research the focused layer.
2. Plan the smallest safe implementation.
3. Execute within existing patterns.
4. Review edge cases, validation gaps, and bypass paths.

Do not rely on frontend guards as enforcement. The console may guide users, but backend services must enforce auth, tenant/product access, lead capture, inquiry capture, state transitions, and audit logging.

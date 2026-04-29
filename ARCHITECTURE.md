# Workside Support Console Architecture

## Purpose
The Workside Support Console is the internal operations layer for conversations across Merxus AI, Workside Home Advisor, Workside Logistics, and future Workside products. It lets authenticated Workside staff monitor sessions, accept human transfers, reply, capture lead/inquiry data, and close sessions.

## Frontend
- Runtime: Vite web app.
- Main application logic: `src/main.js`.
- API layer: `src/services/api.js` and `src/services/chat.js`.
- Auth bridge: `src/services/auth.js`.
- Error mapping: `src/services/chatErrors.js`.
- UI state is currently held in a single in-memory `state` object with selected fields persisted to `localStorage`.

## Backend Contract
The console consumes a shared chat engine API under `/support`. The backend owns persistence, authorization, session state transitions, audit logs, notifications, and realtime delivery.

Expected backend responsibilities:
- Validate Firebase ID tokens.
- Derive support role, allowed products, and allowed tenant IDs from custom claims.
- Scope every read/write by product and tenant.
- Enforce lead capture, inquiry capture, takeover/reply rules, and close rules server-side.
- Return structured errors with `code`, `requiredAction`, `missingFields`, and `sessionId` when applicable.
- Write audit logs for protected actions and blocked enforcement attempts.

## Data Flow
1. User signs in through Firebase or supplies an integration token.
2. The console stores/refreshes the token and sends it on support API requests.
3. List endpoints populate product, tenant, and session views.
4. Detail endpoints return session metadata plus ordered messages.
5. Mutating actions return refreshed session detail where possible.
6. Backend structured errors are mapped into UI actions such as opening lead or inquiry panels.

## Integrations
- Firebase: internal staff authentication and role/custom-claim access scope.
- MongoDB/chat engine storage: sessions, messages, leads, inquiries, tenant config, and audit logs.
- Twilio or channel providers: chat/SMS delivery depending on product configuration.
- Notification providers: email, SMS, Slack, and console alerts for urgent inquiries.

## Realtime Model
The target realtime channel is `/support/realtime`, using WebSocket or SSE. The current console also supports polling so operations remain usable while realtime is being completed or verified.

Expected event categories:
- `session.created`
- `session.updated`
- `message.created`
- `inquiry.created`
- `inquiry.updated`
- `notification.sent`

## State Machine
Canonical session statuses:
- `active_ai`
- `escalated`
- `active_human`
- `after_hours_intake`
- `closed`

Valid transitions:
- `active_ai -> escalated`
- `active_ai -> after_hours_intake`
- `active_ai -> closed`
- `escalated -> active_human`
- `escalated -> closed`
- `active_human -> closed`
- `after_hours_intake -> closed`

The frontend may disable invalid actions for usability, but the backend must reject invalid transitions.

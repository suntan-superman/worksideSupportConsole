# Workside Mobile Support App Spec

## Goal

Provide support personnel a lightweight mobile app for receiving, accepting, and responding to live transfer requests when they are away from the desktop support console.

The mobile app must use the same backend authority as the web console. It should not create its own routing, tenant, product, or authorization rules.

## Primary Users

- Support agents assigned to sales, support, billing, or general inquiries.
- Support admins or super admins who need visibility into urgent/no-agent-available queues.

## Core Use Cases

1. Set availability.
2. Receive a push/SMS notification for a new assigned support request.
3. Review customer/contact details and recent conversation history.
4. Accept transfer.
5. Send replies to the customer.
6. Add internal notes.
7. Close or mark follow-up required.
8. View multiple active assigned sessions and switch between them.

## Authentication

Use Firebase Authentication, same project as the support console.

The mobile app must send Firebase ID tokens:

```http
Authorization: Bearer <firebase_id_token>
```

Backend must verify that the authenticated user is an active support-console user before returning support data.

Unauthorized users must see:

```text
This account is not authorized for the Workside Support Console.
```

## Required Backend Endpoints

### Availability

```http
GET /support/users/me/availability
POST /support/users/me/availability
POST /support/users/me/heartbeat
```

Availability statuses:

```text
available
busy
away
offline
do_not_disturb
```

Mobile should heartbeat every 45-60 seconds while foregrounded and marked available.

### Assigned Sessions

```http
GET /support/sessions?assignedTo=me&status=escalated,active_human
GET /support/sessions/:sessionId
```

Session payload must include:

```json
{
  "id": "CA...",
  "status": "escalated",
  "transferRequested": true,
  "routingStatus": "assigned",
  "availabilityOutcome": "available_agent_found",
  "intent": "support",
  "departmentId": "support",
  "departmentLabel": "Support",
  "assignedToUserId": "user_id",
  "assignedToName": "Mike",
  "leadName": "Customer Name",
  "leadEmail": "customer@example.com",
  "leadPhone": "+16615551111",
  "messages": []
}
```

### Transfer And Reply

```http
POST /support/sessions/:sessionId/takeover
POST /support/sessions/:sessionId/reply
POST /support/sessions/:sessionId/notes
POST /support/sessions/:sessionId/close
```

Rules:

- No reply before takeover.
- No close when required lead/inquiry data is missing.
- No cross-product or cross-tenant access.
- Backend remains final authority for every state transition.

## Push Notification Requirements

Use Firebase Cloud Messaging or another platform push provider.

Notification payload:

```json
{
  "type": "support_session_assigned",
  "sessionId": "CA...",
  "product": "merxus",
  "tenantId": "tenant_or_customer_id",
  "intent": "support",
  "departmentId": "support",
  "customerName": "Jerry Seinfeld",
  "urgency": "high"
}
```

Notification title:

```text
New support request
```

Notification body:

```text
Jerry Seinfeld needs Support help.
```

Tapping the notification should open the session detail screen.

## App Screens

### Sign In

- Email/password.
- One-time code if backend supports it.
- Clear unauthorized-account message.

### Availability

Top-level selector:

- Available
- Busy
- Away
- Offline
- Do not disturb

When set to available, app starts heartbeat.

When app backgrounds, backend should eventually mark the user away/offline unless manual override is active.

### Active Sessions

List assigned active sessions with:

- Customer name.
- Intent.
- Department.
- Routing status.
- Last interaction time.
- Waiting state:
  - Waiting on support
  - Waiting on customer
  - No activity
  - Needs acceptance

Use clear color indicators, but do not rely on color alone.

### Session Detail

Show:

- Contact info.
- Product/customer.
- Department/intent.
- Routing status.
- Conversation messages.
- Internal notes.

Actions:

- Accept Transfer.
- Reply.
- Save Note.
- Close.
- Send Transcript, optional later.

### Reply Composer

- Disable until takeover is accepted.
- Warn against sensitive data.
- Show sending/sent/failed state.

## Offline And Background Behavior

- App must not claim the agent is available indefinitely without heartbeat.
- Backend should expire availability based on `lastSeenAt`.
- If push arrives while app is closed, user can open directly into the session.
- If reply fails due to stale state, reload session and show a friendly message.

## Admin Mobile Scope

Initial mobile app should focus on support personnel.

Admin features can be added later:

- No-agent-available alerts.
- Mute admin notifications.
- Reassign session.
- View department coverage.

## Security Requirements

- Firebase auth required.
- Active support user record required.
- Backend enforces product/tenant/department scope.
- Internal notes never sent to customers.
- Mobile app must not expose diagnostics, raw auth claims, or backend traces.
- Token refresh must be handled before API calls.

## MVP Acceptance Criteria

- Support user can sign in only if authorized.
- Support user can set availability.
- Backend receives heartbeat while user is available.
- Assigned transfer sends mobile notification.
- Tapping notification opens session.
- User can accept transfer.
- User can see conversation history after acceptance.
- User can reply to customer.
- User can save an internal note.
- User can close the session when backend rules permit it.


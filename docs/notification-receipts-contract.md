# Notification Receipts Contract

Date: 2026-06-28

## Purpose

Support operators and admins must be able to answer: who was notified, by which channel, when, and what happened.

## Receipt Shape

```ts
type NotificationReceipt = {
  id: string;
  sessionId: string;
  product: string;
  tenantId?: string;
  type: "support_session_assigned" | "admin_no_agent_available" | "transcript_sent" | string;
  channel: "push" | "sms" | "email" | "slack" | "console" | string;
  provider?: string;
  recipientId?: string;
  recipientLabel?: string;
  recipientAddressMasked?: string;
  attemptedAt: string;
  deliveredAt?: string;
  status: "pending" | "sent" | "delivered" | "failed" | "skipped" | "muted";
  muted?: boolean;
  skippedReason?: string;
  errorCode?: string;
  errorMessage?: string;
  providerMessageId?: string;
  retryCount?: number;
};
```

## Backend Endpoints

```http
GET /support/sessions/:sessionId/notifications
```

Session detail may also embed receipts as:

```json
{
  "session": {},
  "messages": [],
  "notificationReceipts": []
}
```

## Frontend Display Rules

- Show receipt timeline in session detail.
- Show failed, skipped, and muted states distinctly.
- Mask phone numbers and email addresses when possible.
- Do not display provider secrets, raw request payloads, raw tokens, or full transcript text.
- Do not include sensitive transcript content in push/SMS notification bodies.

## Production Readiness

Notification failure must not roll back valid session state transitions. Instead, persist a failed receipt and surface it in WSC.

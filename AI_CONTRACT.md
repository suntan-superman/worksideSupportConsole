# Workside AI and Support API Contract

## Response Envelope
Successful responses may return either direct payloads or named payloads. The frontend normalizers accept both during integration, but canonical backend responses should prefer named fields.

```json
{
  "session": {},
  "messages": []
}
```

Errors must be structured:

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

## Required Error Fields
- `code`: stable machine-readable error code.
- `message`: safe user-facing message.
- `requiredAction`: optional next UI action.
- `missingFields`: optional list for validation blockers.
- `sessionId`: optional session reference for refresh/focus flows.

## Supported Required Actions
- `login`
- `collect_lead`
- `collect_name`
- `collect_email`
- `collect_phone`
- `collect_inquiry`
- `refresh_session`
- `contact_admin`

## Canonical Session Shape
```ts
type ChatSession = {
  id: string;
  tenantId: string;
  tenantName?: string;
  product: "merxus" | "home_advisor" | "workside_logistics" | string;
  status: "active_ai" | "escalated" | "active_human" | "after_hours_intake" | "closed";
  lead?: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    captured?: boolean;
  };
  inquiry?: {
    required?: boolean;
    captured?: boolean;
    inquiryId?: string;
    messageSummary?: string;
    urgency?: "low" | "medium" | "high" | string;
    intent?: string;
  };
  transfer?: {
    requested?: boolean;
    reason?: string;
    note?: string;
    accepted?: boolean;
    acceptedBy?: string;
  };
  assignedToUserId?: string;
  createdAt: string;
  updatedAt: string;
};
```

## Canonical Message Shape
```ts
type ChatMessage = {
  id: string;
  sessionId: string;
  tenantId: string;
  sender: "visitor" | "ai" | "agent" | "system";
  body: string;
  createdAt: string;
};
```

## Route Contract
- `GET /support/products` returns product options available to the authenticated user.
- `GET /support/tenants?product=merxus` returns tenant options available to the authenticated user.
- `GET /support/sessions` returns list items scoped by role, tenant, product, filters, and pagination.
- `GET /support/sessions/:sessionId` returns `{ session, messages, inquiry?, auditEvents? }`.
- `POST /support/sessions/:sessionId/request-transfer` requires valid access, lead capture when configured, and a valid transition to `escalated`.
- `POST /support/sessions/:sessionId/takeover` requires an escalated session and a role allowed to take over.
- `POST /support/sessions/:sessionId/reply` requires `active_human`.
- `PATCH /support/sessions/:sessionId/lead` validates and persists lead fields, then recalculates lead capture state.
- `POST /support/sessions/:sessionId/inquiry` requires lead capture first, persists inquiry details, and marks inquiry captured.
- `POST /support/sessions/:sessionId/close` requires lead capture and inquiry capture when applicable, then transitions to `closed`.

## AI Behavior Contract
- AI may handle `active_ai` sessions while enabled.
- AI must stop auto-replying after human takeover.
- AI or backend automation may request transfer when confidence is low, the visitor asks for a person, urgency is high, or product-specific rules require human review.
- AI should capture safe lead and inquiry details only; do not request passwords, card numbers, or sensitive personal data.

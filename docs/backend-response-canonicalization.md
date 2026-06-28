# Backend Response Canonicalization

Date: 2026-06-28

## Goal

Reduce frontend ambiguity by converging backend responses onto stable canonical shapes.

## Canonical Session Detail

```json
{
  "session": {
    "id": "sess_123",
    "product": "merxus",
    "tenantId": "tenant_123",
    "tenantName": "Customer Name",
    "status": "escalated",
    "lead": {
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "phone": "+15555551212",
      "company": "Workside",
      "captured": true
    },
    "inquiry": {
      "required": true,
      "captured": true,
      "messageSummary": "Customer needs billing support.",
      "urgency": "medium",
      "intent": "billing"
    },
    "transfer": {
      "requested": true,
      "accepted": false,
      "reason": "user_requested_human"
    },
    "assignedToUserId": "support_user_123",
    "departmentId": "support",
    "routingStatus": "assigned",
    "availabilityOutcome": "available_agent_found",
    "createdAt": "2026-06-28T00:00:00.000Z",
    "updatedAt": "2026-06-28T00:00:00.000Z"
  },
  "messages": [],
  "auditEvents": [],
  "notificationReceipts": []
}
```

## Canonical List

```json
{
  "items": [],
  "page": 1,
  "pageSize": 50,
  "total": 0
}
```

## Canonical Error

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_SESSION_STATE",
    "message": "This session is not ready for takeover.",
    "requiredAction": "refresh_session",
    "missingFields": [],
    "sessionId": "sess_123"
  }
}
```

## Frontend Compatibility Policy

The current frontend accepts many aliases to keep integration moving. Fallback aliases should be removed only after production and staging backends consistently return canonical fields.

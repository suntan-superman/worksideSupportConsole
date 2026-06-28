# Customer Timeline Contract

Date: 2026-06-28

## Purpose

Give agents safe chronological context for a customer across support, product, billing, and release exposure.

## Endpoint

```http
GET /support/customers/:customerId/timeline?productId=...
```

## Event Shape

```json
{
  "id": "evt_123",
  "productId": "sageset",
  "tenantId": "tenant_123",
  "customerId": "cust_123",
  "type": "support_conversation",
  "title": "Support conversation opened",
  "summary": "Customer asked about billing settings.",
  "occurredAt": "2026-06-28T00:00:00.000Z",
  "sensitive": false,
  "metadata": {}
}
```

## Rules

- Redact sensitive fields.
- Preserve chronological order.
- Scope by product and tenant.
- Internal notes remain internal.

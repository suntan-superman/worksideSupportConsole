# Billing Context Contract

Date: 2026-06-28

## Purpose

Show safe subscription context to support agents without exposing payment details.

## Endpoint

```http
GET /support/customers/:customerId/billing-context?productId=...
```

## Shape

```json
{
  "customerId": "cust_123",
  "productId": "sageset",
  "plan": "Pro",
  "subscriptionStatus": "active",
  "trialStatus": "none",
  "renewalDate": "2026-07-28",
  "lastPaymentStatus": "paid",
  "failedPayment": false,
  "cancelAtPeriodEnd": false
}
```

## Rules

- Do not expose card numbers, CVC, bank details, or raw Stripe objects.
- Data is read-only in WSC until explicit billing admin workflows are approved.

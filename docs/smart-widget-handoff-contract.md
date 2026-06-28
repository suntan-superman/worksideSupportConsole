# Smart Widget Handoff Contract

Date: 2026-06-28

## Purpose

When AI escalates to a human, the support console should receive useful context without exposing secrets.

## Payload

```json
{
  "product": "sageset",
  "sessionId": "sess_123",
  "userId": "user_123",
  "tenantId": "tenant_123",
  "question": "How do I update billing?",
  "aiAnswerAttempted": true,
  "aiAnswer": "You can update billing from settings...",
  "confidence": 0.72,
  "category": "billing",
  "recommendedAction": "human_takeover",
  "recentEvents": [],
  "diagnostics": {}
}
```

## Safety Rules

- Do not include raw tokens, passwords, payment card data, provider secrets, or stack traces.
- Summaries should be concise and customer-safe.
- Agent must approve any AI-suggested reply before it is sent.

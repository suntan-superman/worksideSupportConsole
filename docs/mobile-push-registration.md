# Mobile Push Registration

Date: 2026-06-28

## Implemented Client Behavior

The mobile app now:

- Requests Expo notification permission.
- Acquires an Expo push token.
- Registers the token with `POST /support/mobile/push-tokens`.
- Sends platform, app version, device name, and installation/session metadata when available.
- Caches the backend token id locally to avoid duplicate active registrations.
- Revokes the token on sign out with `DELETE /support/mobile/push-tokens/:tokenId`.

## Required Backend Behavior

`POST /support/mobile/push-tokens` should:

- Authenticate the support user.
- Validate the user is active.
- Store token, platform, app version, device metadata, support user id, and timestamps.
- Deactivate duplicate tokens for the same user/device.
- Return `{ tokenId }`.

`DELETE /support/mobile/push-tokens/:tokenId` should:

- Authenticate the support user.
- Ensure the token belongs to that user or an allowed admin.
- Mark the token inactive.

## Push Payload

```json
{
  "type": "support_session_assigned",
  "sessionId": "sess_123",
  "product": "merxus",
  "tenantId": "tenant_123",
  "customerName": "Customer",
  "urgency": "high"
}
```

Notification bodies must avoid sensitive transcript content.

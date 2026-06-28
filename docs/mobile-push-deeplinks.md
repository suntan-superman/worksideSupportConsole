# Mobile Push Deep Links

Date: 2026-06-28

## Implemented Client Behavior

The mobile app listens for Expo notification responses. If the notification payload contains `sessionId`, `session_id`, or `supportSessionId`, the app routes to:

```text
/session/:sessionId
```

## Error Handling

The session detail screen already handles unauthorized state by signing out and redirecting to login. Backend `404` or permission-denied outcomes should be surfaced as friendly session-load errors in a future UI pass.

## Required Payload Field

Use `sessionId` for new notifications.

```json
{
  "type": "support_session_assigned",
  "sessionId": "sess_123"
}
```

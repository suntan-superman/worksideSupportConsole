# Live Conversation Widget Contract

Date: 2026-05-01

## Problem

The deployed support console is receiving sessions, but the end-user chat/feedback modal is not behaving like a live conversation:

- The visitor types a message and submits it.
- The modal disappears.
- The visitor does not see their message, the AI response, or human-agent responses in the modal.
- The support console receives message-like records, but some arrive with missing sender/body metadata and render as `System` or literal `undefined`.

This needs backend and widget alignment. The support console can display normalized messages, but it cannot make the public widget feel live unless the visitor-side API stores and returns canonical conversation messages.

## Required Backend Behavior

### 1. Public widget submit must not be feedback-only

The current modal appears to be using a feedback-submit flow. For live support, the widget needs a chat message route that keeps the conversation open.

Recommended route:

```http
POST /chat/public/session/:sessionId/messages
```

Request:

```json
{
  "message": "I need support",
  "product": "merxus",
  "tenantId": "office_...",
  "sourceApp": "website",
  "pageUrl": "https://..."
}
```

Response:

```json
{
  "session": {
    "id": "CA...",
    "status": "active_ai",
    "transferRequested": false
  },
  "messages": [
    {
      "id": "msg_1",
      "sessionId": "CA...",
      "sender": "visitor",
      "body": "I need support",
      "createdAt": "2026-05-01T14:47:00.000Z"
    },
    {
      "id": "msg_2",
      "sessionId": "CA...",
      "sender": "ai",
      "body": "Thanks. I can help here, and I can also notify our team if you would like to talk to a person.",
      "createdAt": "2026-05-01T14:47:01.000Z"
    }
  ]
}
```

The route must store the visitor message before returning. If AI replies, store that as a separate `sender: "ai"` message.

### 2. Public widget must poll or subscribe for new messages

Recommended route:

```http
GET /chat/public/session/:sessionId/messages
```

Response:

```json
{
  "session": {
    "id": "CA...",
    "status": "active_human",
    "transferRequested": true,
    "humanAccepted": true
  },
  "messages": [
    {
      "id": "msg_1",
      "sender": "visitor",
      "body": "I need support",
      "createdAt": "2026-05-01T14:47:00.000Z"
    },
    {
      "id": "msg_2",
      "sender": "ai",
      "body": "I’m notifying our team now. Someone will join the chat as soon as possible.",
      "createdAt": "2026-05-01T14:47:04.000Z"
    },
    {
      "id": "msg_3",
      "sender": "agent",
      "body": "Hi, this is Mike. I can help.",
      "createdAt": "2026-05-01T14:48:10.000Z"
    }
  ]
}
```

The widget should poll this route every few seconds, or subscribe through realtime, while the modal is open.

### 3. Canonical message shape

Every stored and returned message must use this shape:

```ts
type ChatMessage = {
  id: string;
  sessionId: string;
  tenantId: string;
  sender: "visitor" | "ai" | "agent" | "system";
  body: string;
  createdAt: string;
  visibleToVisitor: boolean;
};
```

Rules:

- `body` must never be `undefined`, `null`, or the string `"undefined"`.
- Visitor text must be `sender: "visitor"`.
- AI text must be `sender: "ai"`.
- Human support replies must be `sender: "agent"`.
- Internal audit/status notes should be `sender: "system"` and `visibleToVisitor: false` unless intentionally shown to the visitor.

### 4. Support reply must be visible to public widget

When the support console calls:

```http
POST /support/sessions/:sessionId/reply
```

the backend must:

1. Validate session is `active_human`.
2. Store a canonical message:

```json
{
  "sender": "agent",
  "body": "Hi, this is Mike. I can help.",
  "visibleToVisitor": true
}
```

3. Return the updated session detail to the console.
4. Make that same message available through the public widget message route.

### 5. Human transfer status must be visible to public widget

When transfer is requested:

- Set `session.status = "escalated"` or equivalent.
- Add visitor-visible AI/system message only if appropriate:

```json
{
  "sender": "ai",
  "body": "I’m notifying our team now. Someone will join the chat as soon as possible.",
  "visibleToVisitor": true
}
```

When a human accepts:

- Set `session.status = "active_human"`.
- Stop automatic AI replies for that session.
- Public widget should continue showing the same conversation and allow visitor replies.

### 6. Do not close the modal after submit

The frontend widget should treat submit as `send message`, not `submit feedback and close`.

Expected visitor behavior:

1. Visitor enters message.
2. Message appears immediately in the modal as pending/sent.
3. Modal remains open.
4. AI response or transfer status appears.
5. Human replies appear after takeover.

## Support Console Frontend Compatibility

The support console has been hardened to:

- Ignore empty/undefined message bodies.
- Recognize common sender aliases such as `customer`, `assistant`, `bot`, `support_agent`, `incoming`, `outgoing_ai`, and `agent_reply_sent`.

This is a compatibility layer only. The backend should still return the canonical message shape above.

## Acceptance Tests

- [ ] Visitor submits `I need support`; modal stays open.
- [ ] Visitor message appears in the widget immediately.
- [ ] Support console shows the same visitor message as `Visitor`, not `System`.
- [ ] AI response appears in both widget and support console as `AI`.
- [ ] Transfer request changes session to waiting-for-human state.
- [ ] Support agent accepts transfer.
- [ ] Support agent reply appears in the public widget without refreshing the page.
- [ ] Visitor can reply after human takeover.
- [ ] AI does not continue responding after human takeover.
- [ ] No message in either UI displays literal `undefined`.

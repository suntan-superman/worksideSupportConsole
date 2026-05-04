# Workside Support Console + Merxus Web — Explicit Codex Instructions
## Frontend Production Hardening for Support Chat + Live Human Handoff

**Projects:**  
1. Workside Support Console frontend  
2. Merxus web app public chat widget  

**Purpose:** Align both frontends with the hardened backend contract for public chat, live human handoff, support-user availability, notification observability, and regression-safe UI behavior.

---

# 1. Current Status

The frontend systems are in internal beta / controlled pilot shape.

What is working:
- Support Console login and support-user authorization.
- Global session queue and filters.
- Session detail, lead capture, inquiry capture.
- Transfer request, takeover, reply, close, no-follow-up close.
- Notes, transcript send, assignment, departments, support users.
- Availability controls and heartbeat.
- Public Merxus website chat widget for product Q&A and human request.
- Polling-based updates.

Remaining risks:
- Need end-to-end proof of browser widget → backend → support console → customer reply.
- Notification delivery must be visible in console.
- Availability/heartbeat status must be clear and reliable.
- `src/main.js` in Support Console is too large.
- Frontend tests are missing.
- Public chat error parsing must handle final structured backend errors.

---

# P0 — Blocking Production Confidence

## 1. Verify and harden Support Console heartbeat loop

### Required behavior

When a support agent is logged in and marked available:

1. Call:

```http
POST /support/users/me/availability
```

when availability changes.

2. Call:

```http
POST /support/users/me/heartbeat
```

every 30–60 seconds while the console is open and the agent is available.

3. Stop/clear heartbeat when:
   - user logs out
   - browser tab/session ends if possible
   - user changes status to away/busy/offline

4. Display backend-derived effective availability:
   - available
   - stale
   - quiet
   - offline
   - busy/away

### UI requirement

Add a clear indicator:

```txt
Available — heartbeat fresh
Available but stale — routing paused
Away — not assignable
Quiet until 2:30 PM
```

### Codex task

Inspect current heartbeat implementation and ensure:
- starts only after auth/support user is loaded
- runs only once
- clears interval on logout/unmount
- reports failures in diagnostics
- refreshes backend availability state after status changes

---

## 2. Add notification status/timeline to session detail

### Required UI

In session detail, add a “Routing / Notifications” section showing:

- routing status
- assigned user
- department
- availability outcome
- notification attempted
- notification channel
- recipient
- sent/failed/skipped
- mute/skipped reason
- timestamp

Example:

```txt
Routing
Assigned to: Stan Roy
Department: Sales
Availability: available_agent_found

Notifications
SMS to +1 xxx-xxx-1234 — Sent — 10:42 AM
Admin fallback — Skipped — muted
```

### Data sources

Normalize in `src/services/chat.js`:
- `support.routing.notificationStatus`
- `notificationTimeline`
- `routingStatus`
- `availabilityOutcome`
- assigned user fields

---

## 3. Add frontend tests for `src/services/chat.js`

### Add test framework if missing

Recommended:

```bash
npm install -D vitest
```

Add script:

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

### Tests to add

- status mapping
- transfer requested variants
- routing fields
- notification timeline fields
- support notes
- transcript receipts
- lead/contact fallback fields
- structured error object parsing

Success criteria:

```bash
npm test
npm run build
```

both pass.

---

## 4. Add browser smoke test for core support flow

Recommended:

```bash
npm install -D @playwright/test
```

Add script:

```json
{
  "scripts": {
    "test:e2e": "playwright test"
  }
}
```

Minimum smoke flow:
1. login as support user
2. load sessions
3. select a session
4. accept transfer if escalated
5. send reply
6. save note
7. optionally send transcript

If full backend fixtures are not ready, start with login + session list + detail selection.

---

## 5. Harden public chat widget error handling

### Problem

Backend will move to structured errors:

```json
{
  "ok": false,
  "error": {
    "code": "CODE",
    "message": "Human readable message",
    "requiredAction": "action"
  },
  "details": {}
}
```

### Required behavior

Update public chat client code to handle:
- `payload.error` as object
- legacy `payload.error` as string
- top-level `message`
- top-level `code`

Never render `[object Object]`.

Focus files:
- Merxus web app: `web/src/api/publicChat.js`
- Merxus web app: `web/src/components/chat/WebsiteChatWidget.jsx`

Test cases:
- invalid email
- missing name/email when requesting human
- session closed
- no agent available
- backend 500 fallback

---

# P1 — High Value

## 1. Split Support Console `src/main.js`

### Problem

`src/main.js` owns too much workflow and rendering logic.

### Extract incrementally

Suggested structure:

```txt
src/
  state/
    polling.js
    availability.js
    filters.js
  render/
    sessionList.js
    sessionDetail.js
    adminPanel.js
    dialogs.js
  workflows/
    sessionActions.js
    adminActions.js
    transcriptActions.js
  services/
    api.js
    auth.js
    chat.js
    chatErrors.js
```

Do not rewrite everything at once.

Extraction order:
1. normalization tests first
2. session action handlers
3. availability/heartbeat state
4. dialogs
5. session list/detail render helpers

Success criteria:
- no UI behavior change
- build passes after each extraction
- tests pass

---

## 2. Add active filter summary

Add visible summary near Sessions header:

```txt
Filters: Product = Merxus AI · Status = AI · Assigned = All
```

Add:

```txt
Clear filters
```

when filters are active.

---

## 3. Surface backend availability coverage

Add admin/support panel showing:
- available agents by department
- stale agents
- quiet agents
- offline agents
- no-agent coverage warnings

This answers:
“Will a public chat request actually reach someone?”

---

## 4. Remove compatibility fallbacks after contract stabilizes

After backend consistently returns canonical routes/payloads:
- remove transcript fallback from `/send-transcript` if no longer needed
- reduce broad transfer flag tolerance
- reduce defensive response shape parsing

Do not remove until backend deployment is verified.

---

# P2 — Polish / Scale

- Metrics dashboard from `/support/metrics`
- Dedicated leads view
- Dedicated inquiries view
- Dedicated audit timeline view
- Mobile support app implementation
- Push notification registration/device token management
- Visual notification preferences per support user
- Future SSE/WebSocket after backend realtime path is proven

---

# End-to-End Manual QA Plan

## Scenario 1 — Anonymous product question

1. Open Merxus public website.
2. Ask: “How is Merxus different from competitors?”
3. Confirm AI answers using knowledge base.
4. Confirm no lead required for basic answer.

## Scenario 2 — Anonymous visitor requests human

1. Ask to speak to a person.
2. Confirm widget requires valid name/email.
3. Enter name/email.
4. Submit human request.
5. Confirm backend creates/escalates support session.
6. Confirm session appears in Support Console within polling interval.

## Scenario 3 — Available agent flow

1. Support agent sets availability to available.
2. Verify heartbeat fresh.
3. Visitor requests human.
4. Confirm agent assignment.
5. Confirm notification status appears in detail.
6. Agent accepts transfer.
7. Agent replies.
8. Visitor sees reply.

## Scenario 4 — No agent available

1. Set all agents away/offline/stale.
2. Visitor requests human.
3. Confirm visitor gets no-agent/follow-up message.
4. Confirm admin fallback notification attempt or mute-skipped reason appears.

## Scenario 5 — Timeout cleanup

1. Start public chat.
2. Let it become stale or run backend cleanup.
3. Confirm backend closes session with `visitor_inactivity_timeout`.
4. Confirm Support Console shows closed/timeout reason.

---

# Frontend Codex Master Prompt

```txt
Implement the next production-hardening pass for the Workside Support Console and Merxus public chat widget.

Focus only on frontend changes.

P0 requirements:
1. Verify and harden the Support Console availability/heartbeat loop. Ensure heartbeat runs every 30–60 seconds only while logged in and available, clears on logout/unmount, and displays backend effective availability/heartbeat freshness.
2. Add routing/notification status to session detail. Show assigned user, department, availability outcome, notification attempts, sent/failed/skipped channel results, mute/skipped reasons, and timestamps.
3. Add Vitest tests for src/services/chat.js normalization: status mapping, transfer flags, routing fields, notification timeline, notes, transcript receipts, lead/contact fallback fields, and structured error parsing.
4. Add an initial Playwright smoke test or equivalent browser smoke test for login + sessions list + session detail selection. If feasible, include accept transfer and reply.
5. Update Merxus public chat widget/api error handling so structured backend errors never render as [object Object]. Handle both legacy string errors and final { error:{code,message,requiredAction} } envelopes.

P1 requirements:
6. Begin splitting the oversized Support Console src/main.js into focused modules without changing behavior. Extract session actions, availability/polling, dialogs, and render helpers incrementally.
7. Add an active filter summary and clear-filters action near the session list.
8. Add backend availability coverage display for available/stale/quiet/offline agents by department if data is available.

Do not weaken backend-authoritative enforcement. Frontend should guide users but backend remains the source of truth. Run npm run build and add npm test where applicable.
```

---

# Frontend Definition of Done

- [ ] Heartbeat does not duplicate intervals.
- [ ] Backend effective availability is visible.
- [ ] Notification status appears in session detail.
- [ ] Public chat structured errors show clean messages.
- [ ] `npm run build` passes.
- [ ] `npm test` or equivalent normalization tests pass.
- [ ] Initial browser smoke test exists.
- [ ] Active filter summary reduces operator confusion.
- [ ] No behavior regressions in transfer/takeover/reply/close.
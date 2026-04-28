
# Workside Conversational Platform — Support Console Spec
## Codex-Ready Implementation Guide

**Purpose:** Build an internal support/operations console where Workside Software staff can monitor, filter, take over, respond to, assign, and resolve chat sessions from all connected products:

- Merxus AI
- Workside Home Advisor
- Workside Logistics
- Future Workside products

This console is not just “support chat.” It is the operational command center for conversations, leads, inquiries, escalations, and follow-up tasks across the Workside ecosystem.

---

# 1. Product Definition

## 1.1 What We Are Building

Build a new internal web application called:

```txt
Workside Conversational Platform — Support Console
```

The console will connect to the shared chat engine backend and allow authenticated internal users to:

- View active chat sessions
- View after-hours inquiries
- Filter by product, tenant, urgency, intent, and status
- Take over AI conversations
- Reply as a human agent
- Assign conversations or inquiries to staff
- View AI summaries and extracted lead details
- Mark sessions resolved or closed
- See notification status
- Review audit history
- Monitor operational metrics

---

# 2. High-Level Architecture

```txt
apps/
  support-console/
    src/
      app/
      components/
      pages/
      hooks/
      services/
      auth/
      types/

services/
  chat-engine-api/
    src/
      routes/
      controllers/
      services/
      repositories/
      websocket/
      security/
      notifications/
```

The support console is a separate internal web app that consumes the shared chat engine API.

---

# 3. Core User Roles

```ts
type SupportConsoleRole =
  | "super_admin"
  | "admin"
  | "support_agent"
  | "sales_agent"
  | "dispatcher"
  | "viewer";
```

## 3.1 Role Permissions

### super_admin

Can access everything.

- All products
- All tenants
- All sessions
- All inquiries
- All users
- All settings
- Audit logs
- Assignment rules

### admin

Can access assigned products and tenants.

- View sessions
- Take over chats
- Assign chats
- Resolve inquiries
- View reports
- Manage limited settings

### support_agent

Can handle general support sessions.

- View assigned sessions
- Take over support chats
- Reply to users
- Resolve support inquiries

### sales_agent

Can handle lead/sales conversations.

- View sales intent sessions
- View captured leads
- Follow up
- Assign or resolve sales inquiries

### dispatcher

Primarily for Workside Logistics.

- View Workside Logistics conversations
- Handle dispatch/delivery/route issues
- Escalate safety or route deviation concerns

### viewer

Read-only access.

- View sessions and summaries
- Cannot reply
- Cannot assign
- Cannot close

---

# 4. Access Control Rules

Every query must be scoped by:

```ts
type AccessScope = {
  userId: string;
  role: SupportConsoleRole;
  allowedProducts: Array<"merxus" | "home_advisor" | "workside_logistics">;
  allowedTenantIds: string[];
};
```

## 4.1 Enforcement

Before returning any session, inquiry, or message:

```ts
function assertCanAccessConversation(user, conversation) {
  if (user.role === "super_admin") return;

  if (!user.allowedProducts.includes(conversation.product)) {
    throw new Error("PRODUCT_ACCESS_DENIED");
  }

  if (!user.allowedTenantIds.includes(conversation.tenantId)) {
    throw new Error("TENANT_ACCESS_DENIED");
  }
}
```

---

# 5. Main Console Views

## 5.1 Dashboard View

Route:

```txt
/support/dashboard
```

Purpose:

Give internal staff a high-level operational snapshot.

### Metrics

Show cards for:

- Active chats
- Waiting for human
- After-hours inquiries
- High urgency issues
- New leads today
- Resolved today
- Average response time
- AI containment rate

### Product Breakdown

Show counts by:

- Merxus AI
- Home Advisor
- Workside Logistics

### Suggested UI Layout

```txt
------------------------------------------------------
| Workside Conversational Platform                   |
------------------------------------------------------
| Active | Waiting | After-Hours | High Urgency       |
------------------------------------------------------
| Product Breakdown                                  |
| Merxus | Home Advisor | Workside Logistics         |
------------------------------------------------------
| Latest Escalations                                 |
------------------------------------------------------
| Recent Inquiries                                   |
------------------------------------------------------
```

---

## 5.2 Live Sessions View

Route:

```txt
/support/sessions
```

Purpose:

Allow agents to view and respond to live conversations.

### Required Filters

- Product
- Tenant
- Status
- Intent
- Urgency
- Assigned agent
- Date range
- Lead captured: yes/no
- Human takeover: yes/no

### Status Values

```ts
type ChatSessionStatus =
  | "active"
  | "awaiting_human"
  | "after_hours_intake"
  | "human_active"
  | "closed";
```

### Session List Columns

- Product
- Tenant
- Visitor/Lead name
- Email
- Intent
- Urgency
- Status
- Assigned to
- Last message time
- AI confidence
- Lead captured

---

## 5.3 Conversation Detail View

Route:

```txt
/support/sessions/:sessionId
```

Purpose:

Show complete chat history and allow human takeover.

### Layout

```txt
------------------------------------------------------
| Header: Product / Tenant / Status / Urgency        |
------------------------------------------------------
| Left Panel: Lead + Session Details                 |
| Center Panel: Conversation Thread                  |
| Right Panel: AI Summary + Actions                  |
------------------------------------------------------
```

### Left Panel

Show:

- Name
- Email
- Phone
- Product
- Tenant
- Organization
- Source URL
- Referrer
- Created date/time
- Last activity
- Status
- Assigned agent

### Center Panel

Show:

- Visitor messages
- AI messages
- Agent messages
- System events
- Timestamps
- Sender labels
- Message status

### Right Panel

Show:

- AI summary
- Detected intent
- Detected urgency
- Extracted entities
- Lead capture status
- Inquiry status
- Suggested next action
- Notification status
- Audit trail shortcut

### Required Actions

Buttons:

- Take Over
- Reply
- Assign
- Escalate
- Create Inquiry
- Mark Resolved
- Close Session
- Reopen Session
- Copy Summary

---

## 5.4 Inquiry Queue View

Route:

```txt
/support/inquiries
```

Purpose:

Manage after-hours inquiries and structured support/sales/dispatch requests.

### Filters

- Product
- Tenant
- Status
- Intent
- Urgency
- Assigned to
- Created date
- Notification sent: yes/no

### Columns

- Product
- Lead name
- Email
- Phone
- Intent
- Urgency
- Summary
- Status
- Assigned to
- Created time

### Inquiry Status Values

```ts
type InquiryStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed";
```

### Actions

- Assign inquiry
- Open related chat
- Send follow-up email
- Send SMS follow-up
- Mark in progress
- Mark resolved
- Add internal note

---

## 5.5 Lead View

Route:

```txt
/support/leads
```

Purpose:

Allow sales/support users to review captured leads from all products.

### Columns

- Name
- Email
- Phone
- Product
- Tenant
- Intent
- Source URL
- First seen
- Last seen
- Latest inquiry status
- Assigned to

### Lead Deduplication

Deduplicate by:

```ts
tenantId + lowerCase(email)
```

For cross-product Workside-owned analytics, optionally deduplicate by:

```ts
lowerCase(email)
```

but never expose cross-tenant data unless the user has permission.

---

## 5.6 Audit Log View

Route:

```txt
/support/audit
```

Purpose:

Review conversation lifecycle events.

### Audit Events

- Session created
- Message created
- Lead captured
- Inquiry captured
- AI handoff recommended
- Human takeover
- Agent reply
- Session assigned
- Inquiry assigned
- Notification sent
- Session closed
- Inquiry resolved

---

# 6. Frontend Components

## 6.1 Component Tree

```txt
SupportConsoleApp
  AuthGate
  AppShell
    SidebarNav
    TopBar
    DashboardPage
    SessionsPage
      SessionFilters
      SessionTable
    SessionDetailPage
      SessionHeader
      LeadPanel
      ConversationThread
      ReplyComposer
      AiSummaryPanel
      SessionActions
    InquiriesPage
      InquiryFilters
      InquiryTable
      InquiryDetailDrawer
    LeadsPage
      LeadFilters
      LeadTable
    AuditPage
      AuditFilters
      AuditTable
```

---

# 7. UI Design Guidance

Use a professional enterprise dashboard design.

## 7.1 Visual Style

- Calm, modern, high-trust interface
- Left navigation always visible
- Clear status badges
- Compact tables
- Generous spacing
- No clutter
- Important urgency states visually obvious

## 7.2 Suggested Sidebar

```txt
Dashboard
Live Sessions
Inquiries
Leads
Audit Logs
Settings
```

## 7.3 Status Badge Rules

```ts
const statusLabels = {
  active: "Active",
  awaiting_human: "Waiting",
  after_hours_intake: "After Hours",
  human_active: "Human Active",
  closed: "Closed"
};
```

## 7.4 Urgency Badge Rules

```ts
const urgencyLabels = {
  low: "Low",
  medium: "Medium",
  high: "High"
};
```

---

# 8. Backend API Routes

All routes require authentication and access control.

---

## 8.1 Dashboard Metrics

```http
GET /support/metrics
```

Query:

```txt
?product=home_advisor&tenantId=abc&from=2026-04-01&to=2026-04-30
```

Response:

```ts
type SupportMetricsResponse = {
  activeChats: number;
  awaitingHuman: number;
  afterHoursInquiries: number;
  highUrgency: number;
  newLeadsToday: number;
  resolvedToday: number;
  averageResponseSeconds: number;
  aiContainmentRate: number;
  byProduct: {
    product: string;
    activeChats: number;
    inquiries: number;
    highUrgency: number;
  }[];
};
```

---

## 8.2 List Sessions

```http
GET /support/sessions
```

Query params:

```txt
product
tenantId
status
intent
urgency
assignedTo
leadCaptured
humanTakeover
from
to
page
pageSize
```

Response:

```ts
type ListSessionsResponse = {
  items: ChatSessionListItem[];
  page: number;
  pageSize: number;
  total: number;
};
```

---

## 8.3 Get Session Detail

```http
GET /support/sessions/:sessionId
```

Response:

```ts
type SessionDetailResponse = {
  session: ChatSession;
  messages: ChatMessage[];
  inquiry?: ChatInquiry;
  auditEvents: ChatAuditLog[];
};
```

---

## 8.4 Take Over Chat

```http
POST /support/sessions/:sessionId/takeover
```

Body:

```json
{
  "agentId": "agent_123"
}
```

Server actions:

1. Validate agent access
2. Set session status to `human_active`
3. Assign agent
4. Disable AI auto-reply for the session
5. Add system message: “A team member has joined the chat.”
6. Write audit log

---

## 8.5 Send Agent Reply

```http
POST /support/sessions/:sessionId/reply
```

Body:

```json
{
  "text": "Thanks for reaching out. I can help with that."
}
```

Server actions:

1. Validate agent access
2. Store message as `senderType: "agent"`
3. Send message to active widget via WebSocket/SSE
4. Update session last activity
5. Write audit log

---

## 8.6 Assign Session

```http
POST /support/sessions/:sessionId/assign
```

Body:

```json
{
  "assignedTo": "agent_456"
}
```

---

## 8.7 Close Session

```http
POST /support/sessions/:sessionId/close
```

Body:

```json
{
  "resolutionNote": "Question answered and follow-up email sent."
}
```

Server must enforce:

- Lead capture if required
- Inquiry capture if after-hours intake
- Audit log

---

## 8.8 List Inquiries

```http
GET /support/inquiries
```

Query params:

```txt
product
tenantId
status
intent
urgency
assignedTo
from
to
page
pageSize
```

---

## 8.9 Update Inquiry

```http
PATCH /support/inquiries/:inquiryId
```

Body:

```json
{
  "status": "in_progress",
  "assignedTo": "agent_123",
  "internalNote": "Left voicemail and sent follow-up email."
}
```

---

## 8.10 List Leads

```http
GET /support/leads
```

Query params:

```txt
product
tenantId
intent
from
to
page
pageSize
```

---

## 8.11 Audit Logs

```http
GET /support/audit
```

Query params:

```txt
product
tenantId
sessionId
inquiryId
actorType
action
from
to
page
pageSize
```

---

# 9. Real-Time Updates

Use WebSockets or Server-Sent Events.

Recommended event channel:

```txt
/support/realtime
```

## 9.1 Events

```ts
type SupportRealtimeEvent =
  | {
      type: "session.created";
      payload: ChatSession;
    }
  | {
      type: "message.created";
      payload: ChatMessage;
    }
  | {
      type: "session.updated";
      payload: ChatSession;
    }
  | {
      type: "inquiry.created";
      payload: ChatInquiry;
    }
  | {
      type: "inquiry.updated";
      payload: ChatInquiry;
    }
  | {
      type: "notification.sent";
      payload: ChatNotification;
    };
```

## 9.2 Console Behavior

When events arrive:

- Update dashboard counters
- Refresh active session row
- Append message to open conversation
- Show toast for high urgency events
- Highlight waiting sessions
- Play optional notification sound for high urgency issues

---

# 10. Human Takeover Rules

## 10.1 AI to Human

AI should recommend handoff when:

- Confidence is below threshold
- User explicitly asks for a person
- User is angry or frustrated
- Issue is high urgency
- User asks billing/account/security questions
- Workside Logistics safety issue is detected
- Route deviation or hazardous-material-related issue is detected

## 10.2 During Human Takeover

When an agent takes over:

```ts
session.status = "human_active";
session.ai.enabled = false;
session.assignedTo = agentId;
```

The AI should stop replying automatically.

## 10.3 Agent Release

Optional future feature:

Agent can release back to AI:

```http
POST /support/sessions/:sessionId/release-to-ai
```

---

# 11. Inquiry Management Workflow

## 11.1 After-Hours Flow

1. Visitor chats
2. AI detects business is closed
3. AI captures name/email/phone as required
4. AI captures inquiry details
5. AI summarizes issue
6. Inquiry is created
7. Team is notified
8. Inquiry appears in support console queue
9. Staff assigns and resolves the inquiry

## 11.2 Required Inquiry Fields

```ts
{
  lead.name
  lead.email
  rawUserDescription
  summary
  intent
  urgency
  status
}
```

Phone should be required for products where `tenantConfig.leadCapture.requirePhone === true`.

---

# 12. Notification Rules

## 12.1 High Urgency

High urgency inquiries should notify immediately through every enabled channel:

- Console toast
- Email
- SMS
- Slack

## 12.2 Medium Urgency

Medium urgency should notify through:

- Console toast
- Email
- Slack if enabled

## 12.3 Low Urgency

Low urgency should appear in the console and optionally send email.

---

# 13. Product-Specific Console Rules

## 13.1 Merxus AI

Show additional fields:

- Tenant vertical: office / real estate / restaurant
- Phone number provisioned
- Twilio status
- Review platform integration status
- SMS opt-in status if available

Common intents:

```ts
"sales" | "support" | "pricing" | "setup" | "sms" | "voice" | "reviews" | "integrations"
```

---

## 13.2 Home Advisor

Show additional fields:

- Visitor type: seller / agent / provider
- Property address if captured
- Report interest
- Photo enhancement interest
- Provider marketplace interest

Common intents:

```ts
"seller_help" | "agent_help" | "provider" | "photo_enhancement" | "pricing_report" | "support"
```

---

## 13.3 Workside Logistics

Show additional fields:

- Client
- Supplier/vendor
- Project
- Request ID
- Route ID
- Driver if available
- Safety flag

Common intents:

```ts
"dispatch" | "delivery_delay" | "route_deviation" | "supplier_status" | "client_request" | "safety" | "support"
```

High urgency rules:

- Safety issue
- Hazardous materials
- Route deviation
- Delivery delay affecting linked vendors
- Failed delivery confirmation

---

# 14. Database Additions

## 14.1 Agent User

```ts
type SupportAgent = {
  id: string;
  name: string;
  email: string;
  role: SupportConsoleRole;

  allowedProducts: Array<"merxus" | "home_advisor" | "workside_logistics">;
  allowedTenantIds: string[];

  active: boolean;

  createdAt: Date;
  updatedAt: Date;
};
```

## 14.2 Session Assignment

Add to `ChatSession`:

```ts
assignedTo?: string;
assignedAt?: Date;
humanTakeoverAt?: Date;
humanTakeoverBy?: string;
resolutionNote?: string;
resolvedAt?: Date;
resolvedBy?: string;
```

## 14.3 Internal Notes

```ts
type ChatInternalNote = {
  id: string;

  tenantId: string;
  product: string;
  sessionId?: string;
  inquiryId?: string;

  authorId: string;
  text: string;

  createdAt: Date;
};
```

---

# 15. Security Requirements

## 15.1 Authentication

Use existing auth system if available.

Recommended:

- Firebase Auth for internal users
- Custom claims for roles and allowed products
- Backend validates ID token on every request

## 15.2 Authorization

Backend must enforce access control. Do not rely only on frontend filtering.

## 15.3 PII

PII includes:

- Name
- Email
- Phone
- Chat content
- Property address
- Business account details

Rules:

- Do not log raw PII in server logs
- Hash IP addresses if stored
- Restrict export access
- Audit all agent access to session detail pages

## 15.4 Audit Logging

Every sensitive action must create an audit log.

---

# 16. Suggested React Tech Stack

Use the existing preferred React stack.

Recommended:

- React
- TypeScript
- TailwindCSS
- React Router
- TanStack Query
- WebSocket or SSE client
- Existing auth provider
- Existing component system if available

Optional:

- Syncfusion Grid if already licensed and preferred for enterprise tables

---

# 17. Suggested Backend Tech Stack

- Node.js
- Express or Fastify
- TypeScript
- MongoDB or Firestore depending on the product architecture
- WebSocket or SSE
- Existing notification services:
  - Twilio
  - SendGrid
  - Slack

---

# 18. Codex Implementation Phases

## Phase 1 — Backend Support API

Create the support routes:

```txt
GET    /support/metrics
GET    /support/sessions
GET    /support/sessions/:sessionId
POST   /support/sessions/:sessionId/takeover
POST   /support/sessions/:sessionId/reply
POST   /support/sessions/:sessionId/assign
POST   /support/sessions/:sessionId/close
GET    /support/inquiries
PATCH  /support/inquiries/:inquiryId
GET    /support/leads
GET    /support/audit
```

Add:

- Auth middleware
- Access scope middleware
- Tenant/product filters
- Audit logging

---

## Phase 2 — Support Console Shell

Build:

- App shell
- Sidebar nav
- Top bar
- Auth gate
- Route structure

Routes:

```txt
/support/dashboard
/support/sessions
/support/sessions/:sessionId
/support/inquiries
/support/leads
/support/audit
/support/settings
```

---

## Phase 3 — Live Sessions

Build:

- Session filters
- Session table
- Session detail page
- Conversation thread
- Reply composer
- Takeover button
- Assignment action
- Close session action

---

## Phase 4 — Inquiry Queue

Build:

- Inquiry filters
- Inquiry table
- Inquiry detail drawer
- Assign inquiry
- Update status
- Add internal note
- Open related session

---

## Phase 5 — Real-Time Updates

Add:

- WebSocket or SSE endpoint
- Client subscription
- Message append behavior
- Dashboard counter updates
- Toast alerts for high urgency

---

## Phase 6 — Product-Specific Fields

Add conditional UI sections for:

- Merxus
- Home Advisor
- Workside Logistics

---

## Phase 7 — Security, Audit, and QA

Add:

- Role tests
- Tenant isolation tests
- Audit log tests
- High urgency notification tests
- Lead/inquiry enforcement tests

---

# 19. Codex Prompt — Backend

Use this prompt with Codex:

```txt
Implement the backend support console API for the Workside Conversational Platform.

Use the existing chat engine models and add support routes for metrics, sessions, session detail, human takeover, agent replies, session assignment, session closing, inquiries, leads, and audit logs.

Every route must validate authentication, product access, tenant access, and session ownership. Do not return cross-tenant data. Add audit logs for takeover, reply, assign, inquiry update, and close actions.

Use TypeScript. Follow the existing backend structure. Add repository/service/controller separation. Return paginated responses for list routes. Add tests for tenant isolation and role permissions.
```

---

# 20. Codex Prompt — Frontend

Use this prompt with Codex:

```txt
Build the internal Support Console web app for the Workside Conversational Platform.

Create a React + TypeScript + Tailwind dashboard with a left navigation shell and routes for Dashboard, Live Sessions, Inquiries, Leads, Audit Logs, and Settings.

Implement session filtering, session table, conversation detail view, lead panel, AI summary panel, reply composer, human takeover button, assign action, close action, inquiry queue, inquiry detail drawer, and audit table.

Use the support API routes already defined. Keep the UI clean, enterprise-grade, calm, and easy to scan. Enforce role-based UI visibility, but assume the backend is the final authority.
```

---

# 21. QA Checklist

## Access Control

- [ ] Support agent cannot access unauthorized product
- [ ] Agent cannot access unauthorized tenant
- [ ] Viewer cannot reply
- [ ] Dispatcher only sees Workside Logistics unless otherwise granted

## Sessions

- [ ] Active sessions load
- [ ] Filters work
- [ ] Session detail loads full messages
- [ ] Agent takeover disables AI auto-reply
- [ ] Agent reply appears in user widget
- [ ] Closing session writes audit log

## Inquiries

- [ ] After-hours inquiries appear
- [ ] High urgency inquiries notify team
- [ ] Inquiry can be assigned
- [ ] Inquiry can be marked resolved
- [ ] Internal notes are saved

## Realtime

- [ ] New messages appear without refresh
- [ ] New inquiries appear without refresh
- [ ] Dashboard metrics update
- [ ] High urgency toast appears

## Security

- [ ] No cross-tenant data leakage
- [ ] No raw PII in server logs
- [ ] All sensitive actions are audited

---

# 22. Future Enhancements

- CRM export
- Lead scoring
- Saved replies
- Internal agent notes
- AI suggested replies for agents
- SLA timers
- User timeline across products
- Mobile support console
- Push notifications
- Conversation search
- Sentiment tracking
- Agent performance metrics

---

# 23. Final Architectural Statement

The Support Console is the internal operations layer for the Workside Conversational Platform.

Each app embeds the chat widget.  
All conversations flow into the shared chat engine.  
Support staff use this console to monitor, take over, respond, assign, and resolve conversations across products.

This gives Workside Software one centralized communication layer instead of disconnected chat features inside each app.

# Full Website Chat System — Codex-Ready Implementation Spec

## Project Goal

Add a reusable website chat capability that can be embedded across Workside Software properties, including Merxus AI, Workside Home Advisor, Workside Logistics, Workside Signals, and future products.

The chat system should support:

- AI-first website chat
- Lead capture
- Tenant-aware behavior
- Human escalation
- Optional SMS continuation through Twilio
- Slack/email notifications
- Conversation history
- Admin review dashboard
- Future reuse across multiple products

This should not be treated as a generic chatbot. The long-term goal is to create a reusable **Conversational Operations Layer** that can eventually trigger real backend actions, answer product-specific questions, route requests, and hand conversations off to people when needed.

---

# 1. Recommended Product Model

## Primary Model

Use a hybrid chat model:

1. AI responds immediately.
2. User can request human help.
3. System escalates automatically when confidence is low or intent is sales/support-sensitive.
4. Internal team receives Slack, email, SMS, or dashboard notification.
5. Conversation remains stored for audit, analytics, and follow-up.

## Why Hybrid

Pure live chat requires people to be available. Pure AI chat risks missing valuable leads or mishandling sensitive support situations. Hybrid gives us speed, coverage, and control.

---

# 2. System Scope

## MVP Scope

Build the first version with:

- Floating chat widget for React websites
- Backend chat API
- AI response endpoint
- Conversation/session persistence
- Lead capture fields
- Escalation endpoint
- Admin-visible conversation records
- Slack/email notification hooks

## Later Scope

Add:

- SMS continuation
- Human agent reply dashboard
- Per-tenant knowledge base
- Conversation analytics
- Call handoff through Twilio
- Calendar/booking integrations
- CRM export
- Review request workflows
- Product-specific backend actions

---

# 3. High-Level Architecture

```text
Website / Landing Page
        |
        v
React ChatWidget
        |
        v
Backend API
        |
        +--> AI Chat Service
        |
        +--> MongoDB or Firestore Conversation Store
        |
        +--> Escalation Service
        |       +--> Slack
        |       +--> Email
        |       +--> Twilio SMS
        |
        +--> Admin Dashboard
```

---

# 4. Technology Recommendation

## Frontend

Use React for the web widget.

The widget should be reusable and portable:

```text
/components/chat/ChatWidget.tsx
/components/chat/ChatPanel.tsx
/components/chat/ChatMessageList.tsx
/components/chat/ChatInput.tsx
/components/chat/LeadCaptureForm.tsx
/components/chat/chatApi.ts
```

## Backend

Use the existing Node/Express backend pattern already used in Merxus AI and related projects.

Recommended routes:

```text
POST /api/chat/session
POST /api/chat/message
GET  /api/chat/session/:sessionId
POST /api/chat/escalate
POST /api/chat/lead
POST /api/chat/close
```

## Database Choice

Use the same database as the current product where possible.

For Merxus AI and Firebase-heavy apps:

- Firestore is acceptable and simpler.

For Workside Logistics / Home Advisor where MongoDB already exists:

- MongoDB is acceptable.

Do not introduce MongoDB into a Firebase-only project just for chat unless there is already a strong backend reason.

Recommended approach:

- Build database access behind a repository interface.
- Allow either Firestore or MongoDB implementation.
- Keep API shape identical.

---

# 5. Core Data Models

## ChatSession

```ts
export type ChatSessionStatus =
  | 'active_ai'
  | 'active_human'
  | 'escalated'
  | 'closed';

export type ChatSource =
  | 'website'
  | 'mobile_web'
  | 'admin'
  | 'sms'
  | 'unknown';

export interface ChatSession {
  id: string;
  tenantId: string;
  productKey: 'merxus' | 'home_advisor' | 'workside_logistics' | 'workside_signals' | 'generic';
  status: ChatSessionStatus;
  source: ChatSource;

  visitorId?: string;
  userId?: string;

  leadName?: string;
  leadEmail?: string;
  leadPhone?: string;
  leadCompany?: string;

  pageUrl?: string;
  referrer?: string;
  userAgent?: string;

  summary?: string;
  detectedIntent?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';

  assignedToUserId?: string;
  escalatedAt?: string;
  closedAt?: string;

  createdAt: string;
  updatedAt: string;
}
```

## ChatMessage

```ts
export type ChatMessageSender = 'visitor' | 'ai' | 'agent' | 'system';

export interface ChatMessage {
  id: string;
  sessionId: string;
  tenantId: string;

  sender: ChatMessageSender;
  body: string;

  aiModel?: string;
  aiConfidence?: number;
  aiIntent?: string;

  agentUserId?: string;

  metadata?: Record<string, unknown>;

  createdAt: string;
}
```

## ChatLead

```ts
export interface ChatLead {
  id: string;
  tenantId: string;
  sessionId: string;

  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  message?: string;

  productInterest?: string;
  sourcePage?: string;
  status: 'new' | 'contacted' | 'qualified' | 'closed' | 'spam';

  createdAt: string;
  updatedAt: string;
}
```

## ChatEscalation

```ts
export interface ChatEscalation {
  id: string;
  tenantId: string;
  sessionId: string;

  reason:
    | 'user_requested_human'
    | 'low_ai_confidence'
    | 'sales_opportunity'
    | 'support_issue'
    | 'billing_issue'
    | 'urgent_keyword'
    | 'manual';

  channel: 'slack' | 'email' | 'sms' | 'dashboard';
  status: 'pending' | 'sent' | 'failed' | 'acknowledged' | 'resolved';

  notificationTarget?: string;
  error?: string;

  createdAt: string;
  updatedAt: string;
}
```

---

# 6. Firestore Structure Option

If using Firestore:

```text
chatSessions/{sessionId}
chatSessions/{sessionId}/messages/{messageId}
chatLeads/{leadId}
chatEscalations/{escalationId}
```

Suggested indexes:

```text
chatSessions: tenantId + createdAt DESC
chatSessions: tenantId + status + updatedAt DESC
chatLeads: tenantId + status + createdAt DESC
chatEscalations: tenantId + status + createdAt DESC
```

---

# 7. MongoDB Structure Option

If using MongoDB:

Collections:

```text
chat_sessions
chat_messages
chat_leads
chat_escalations
```

Suggested indexes:

```ts
chat_sessions.createIndex({ tenantId: 1, createdAt: -1 });
chat_sessions.createIndex({ tenantId: 1, status: 1, updatedAt: -1 });
chat_messages.createIndex({ sessionId: 1, createdAt: 1 });
chat_leads.createIndex({ tenantId: 1, status: 1, createdAt: -1 });
chat_escalations.createIndex({ tenantId: 1, status: 1, createdAt: -1 });
```

---

# 8. Backend API Specification

## POST /api/chat/session

Creates or restores a chat session.

### Request

```ts
{
  tenantId: string;
  productKey: string;
  visitorId?: string;
  pageUrl?: string;
  referrer?: string;
  source?: string;
}
```

### Response

```ts
{
  sessionId: string;
  status: string;
  welcomeMessage: string;
}
```

### Behavior

- If visitor has an active session, return it.
- Otherwise create a new session.
- Add a system message: `Chat session started.`
- Return a product-aware welcome message.

---

## POST /api/chat/message

Sends visitor message and returns AI response.

### Request

```ts
{
  sessionId: string;
  tenantId: string;
  message: string;
}
```

### Response

```ts
{
  sessionId: string;
  reply: string;
  status: string;
  escalated: boolean;
  intent?: string;
  confidence?: number;
}
```

### Behavior

1. Validate session.
2. Store visitor message.
3. Load recent conversation history.
4. Load tenant/product context.
5. Call AI chat service.
6. Store AI message.
7. Evaluate escalation rules.
8. Return response.

---

## GET /api/chat/session/:sessionId

Returns session and messages.

### Response

```ts
{
  session: ChatSession;
  messages: ChatMessage[];
}
```

---

## POST /api/chat/escalate

Manually escalates session.

### Request

```ts
{
  sessionId: string;
  tenantId: string;
  reason: string;
  note?: string;
}
```

### Response

```ts
{
  ok: true;
  escalationId: string;
}
```

### Behavior

- Mark session as `escalated`.
- Create escalation record.
- Notify configured internal channel.
- Add system message: `Conversation escalated to human support.`

---

## POST /api/chat/lead

Captures lead details during or after chat.

### Request

```ts
{
  sessionId: string;
  tenantId: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  productInterest?: string;
  message?: string;
}
```

### Response

```ts
{
  ok: true;
  leadId: string;
}
```

---

## POST /api/chat/close

Closes chat session.

### Request

```ts
{
  sessionId: string;
  tenantId: string;
}
```

### Response

```ts
{
  ok: true;
}
```

---

# 9. AI Chat Service

Create:

```text
/services/chat/aiChatService.ts
/services/chat/chatPromptBuilder.ts
/services/chat/chatEscalationService.ts
/services/chat/chatRepository.ts
```

## AI Input Contract

```ts
export interface AiChatInput {
  tenantId: string;
  productKey: string;
  sessionId: string;
  message: string;
  recentMessages: ChatMessage[];
  pageUrl?: string;
  visitorContext?: Record<string, unknown>;
}
```

## AI Output Contract

```ts
export interface AiChatOutput {
  reply: string;
  intent: string;
  confidence: number;
  shouldEscalate: boolean;
  escalationReason?: ChatEscalation['reason'];
  leadFieldsToRequest?: Array<'name' | 'email' | 'phone' | 'company'>;
}
```

---

# 10. AI System Prompt Template

Use a product-specific system prompt.

```text
You are the website assistant for {{PRODUCT_NAME}}.

Your job is to help visitors understand the product, answer common questions, capture qualified leads, and escalate to a human when needed.

Rules:
- Be concise, friendly, and professional.
- Do not invent prices, availability, technical guarantees, legal claims, medical claims, or financial claims.
- If the visitor asks for something uncertain, offer to connect them with a human.
- If the visitor appears interested in buying, booking, scheduling, or requesting a demo, collect name, email, phone, and company when appropriate.
- If the visitor has a support issue, collect enough information to route the issue.
- If the visitor is angry, confused, or reporting a serious issue, escalate.
- Never ask for credit card numbers, passwords, private keys, social security numbers, or sensitive personal data.
- Keep replies under 120 words unless the user asks for detail.

Product context:
{{PRODUCT_CONTEXT}}

Current page:
{{PAGE_URL}}

Recent conversation:
{{RECENT_MESSAGES}}
```

---

# 11. Product Context Examples

## Merxus AI

```text
Merxus AI is an AI phone assistant and communications platform for businesses. It helps answer calls, route messages, capture leads, summarize conversations, support multi-tenant business workflows, and optionally connect with Slack, SMS, and review platforms.
```

## Workside Home Advisor

```text
Workside Home Advisor helps sellers and real estate agents prepare homes for listing by analyzing property details, comparable sales, photos, improvement opportunities, provider needs, and seller-facing reports.
```

## Workside Logistics

```text
Workside Logistics helps companies manage service requests, supplier dispatch, route planning, route adherence, real-time driver tracking, deviation alerts, and supplier performance analytics.
```

## Workside Signals

```text
Workside Signals helps industrial and automation teams monitor operational data, alerts, signals, workflows, and critical events.
```

---

# 12. Escalation Rules

Create deterministic escalation logic in addition to AI output.

## Escalate When

- User asks for a human.
- AI confidence below threshold.
- User mentions billing issue.
- User mentions cancellation.
- User reports bug, outage, or failed payment.
- User appears ready to buy or schedule a demo.
- User shares phone or email and asks to be contacted.
- User expresses frustration.
- Message includes urgent terms.

## Example Implementation

```ts
const URGENT_TERMS = [
  'urgent',
  'emergency',
  'angry',
  'cancel',
  'refund',
  'broken',
  'not working',
  'payment failed',
  'call me',
  'talk to someone',
  'human',
  'representative',
];

export function shouldEscalateChat(input: {
  message: string;
  aiConfidence?: number;
  aiShouldEscalate?: boolean;
}) {
  const text = input.message.toLowerCase();

  if (input.aiShouldEscalate) return true;
  if ((input.aiConfidence ?? 1) < 0.7) return true;

  return URGENT_TERMS.some((term) => text.includes(term));
}
```

---

# 13. Notification Service

Create:

```text
/services/chat/chatNotificationService.ts
```

Support these channels:

- Slack webhook
- SendGrid email
- Twilio SMS
- Dashboard-only fallback

## Notification Payload

```ts
export interface ChatNotificationPayload {
  tenantId: string;
  productKey: string;
  sessionId: string;
  reason: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  messagePreview: string;
  pageUrl?: string;
}
```

## Slack Message Example

```text
New website chat escalation
Product: Workside Home Advisor
Reason: sales_opportunity
Visitor: Stan Roy
Email: stan@example.com
Phone: 555-555-5555
Page: /pricing
Preview: I would like to schedule a demo...
```

---

# 14. Frontend Chat Widget Requirements

## Files

Create:

```text
src/components/chat/ChatWidget.tsx
src/components/chat/ChatPanel.tsx
src/components/chat/ChatMessageList.tsx
src/components/chat/ChatInput.tsx
src/components/chat/LeadCaptureForm.tsx
src/components/chat/chatApi.ts
src/components/chat/types.ts
```

## Widget Behavior

- Floating button in bottom-right corner.
- Opens panel with welcome message.
- Creates session on first open.
- Stores visitorId in localStorage.
- Persists sessionId in localStorage.
- Allows user to send messages.
- Shows typing indicator while backend responds.
- Shows “Talk to a human” button.
- Shows lead capture form when appropriate.
- Handles backend errors gracefully.

## UI Requirements

- Clean professional design.
- Mobile responsive.
- Do not cover critical page CTAs on mobile.
- Message bubbles should be easy to scan.
- Use subtle shadow and rounded corners.
- Avoid clutter.
- Keep the input visible.
- Display a small privacy-safe note such as: `Do not enter passwords or payment information.`

---

# 15. ChatWidget Skeleton

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { createChatSession, sendChatMessage, escalateChat } from './chatApi';
import type { ChatUiMessage } from './types';

interface ChatWidgetProps {
  tenantId: string;
  productKey: 'merxus' | 'home_advisor' | 'workside_logistics' | 'workside_signals' | 'generic';
  apiBaseUrl: string;
}

export function ChatWidget({ tenantId, productKey, apiBaseUrl }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const visitorId = useMemo(() => {
    const key = 'workside_chat_visitor_id';
    let existing = localStorage.getItem(key);
    if (!existing) {
      existing = crypto.randomUUID();
      localStorage.setItem(key, existing);
    }
    return existing;
  }, []);

  useEffect(() => {
    if (!open || sessionId) return;

    async function init() {
      const res = await createChatSession(apiBaseUrl, {
        tenantId,
        productKey,
        visitorId,
        pageUrl: window.location.href,
        referrer: document.referrer,
        source: 'website',
      });

      setSessionId(res.sessionId);
      localStorage.setItem('workside_chat_session_id', res.sessionId);

      setMessages([
        {
          id: crypto.randomUUID(),
          sender: 'ai',
          body: res.welcomeMessage,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    init().catch(() => {
      setMessages([
        {
          id: crypto.randomUUID(),
          sender: 'system',
          body: 'Chat is temporarily unavailable. Please try again soon.',
          createdAt: new Date().toISOString(),
        },
      ]);
    });
  }, [open, sessionId, apiBaseUrl, tenantId, productKey, visitorId]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !sessionId || loading) return;

    setInput('');
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        sender: 'visitor',
        body: trimmed,
        createdAt: new Date().toISOString(),
      },
    ]);

    setLoading(true);
    try {
      const res = await sendChatMessage(apiBaseUrl, {
        tenantId,
        sessionId,
        message: trimmed,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'ai',
          body: res.reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'system',
          body: 'Sorry, something went wrong. Please try again.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleEscalate() {
    if (!sessionId) return;
    await escalateChat(apiBaseUrl, {
      tenantId,
      sessionId,
      reason: 'user_requested_human',
    });

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        sender: 'system',
        body: 'Thanks — I’ve asked someone from our team to review this conversation.',
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white">
            <div className="font-semibold">Chat with us</div>
            <div className="text-xs opacity-80">AI assistant with human backup</div>
          </div>

          <div className="h-[420px] overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={
                  msg.sender === 'visitor'
                    ? 'ml-auto max-w-[80%] rounded-2xl bg-slate-900 text-white px-3 py-2 text-sm'
                    : 'mr-auto max-w-[80%] rounded-2xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-800'
                }
              >
                {msg.body}
              </div>
            ))}
            {loading && <div className="text-xs text-slate-500">Assistant is typing...</div>}
          </div>

          <div className="border-t border-slate-200 p-3 bg-white">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Type your message..."
              />
              <button
                onClick={handleSend}
                disabled={loading}
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm disabled:opacity-50"
              >
                Send
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>Do not enter passwords or payment info.</span>
              <button onClick={handleEscalate} className="underline">
                Talk to human
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-slate-900 text-white shadow-xl px-5 py-3 font-semibold"
      >
        {open ? 'Close' : 'Chat'}
      </button>
    </div>
  );
}
```

---

# 16. Frontend API Client Skeleton

```ts
export async function createChatSession(apiBaseUrl: string, payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/chat/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error('Failed to create chat session');
  return res.json();
}

export async function sendChatMessage(apiBaseUrl: string, payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error('Failed to send chat message');
  return res.json();
}

export async function escalateChat(apiBaseUrl: string, payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/chat/escalate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error('Failed to escalate chat');
  return res.json();
}
```

---

# 17. Backend Route Skeleton

```ts
import express from 'express';
import { chatRepository } from '../services/chat/chatRepository';
import { aiChatService } from '../services/chat/aiChatService';
import { shouldEscalateChat } from '../services/chat/chatEscalationService';
import { notifyChatEscalation } from '../services/chat/chatNotificationService';

export const chatRouter = express.Router();

chatRouter.post('/session', async (req, res) => {
  const { tenantId, productKey, visitorId, pageUrl, referrer, source } = req.body;

  if (!tenantId || !productKey) {
    return res.status(400).json({ error: 'tenantId and productKey are required' });
  }

  const session = await chatRepository.createSession({
    tenantId,
    productKey,
    visitorId,
    pageUrl,
    referrer,
    source: source ?? 'website',
  });

  const welcomeMessage = getWelcomeMessage(productKey);

  await chatRepository.addMessage({
    tenantId,
    sessionId: session.id,
    sender: 'system',
    body: 'Chat session started.',
  });

  return res.json({
    sessionId: session.id,
    status: session.status,
    welcomeMessage,
  });
});

chatRouter.post('/message', async (req, res) => {
  const { tenantId, sessionId, message } = req.body;

  if (!tenantId || !sessionId || !message) {
    return res.status(400).json({ error: 'tenantId, sessionId, and message are required' });
  }

  const session = await chatRepository.getSession(sessionId);
  if (!session || session.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Chat session not found' });
  }

  await chatRepository.addMessage({
    tenantId,
    sessionId,
    sender: 'visitor',
    body: message,
  });

  const recentMessages = await chatRepository.getRecentMessages(sessionId, 20);

  const aiOutput = await aiChatService.respond({
    tenantId,
    productKey: session.productKey,
    sessionId,
    message,
    recentMessages,
    pageUrl: session.pageUrl,
  });

  await chatRepository.addMessage({
    tenantId,
    sessionId,
    sender: 'ai',
    body: aiOutput.reply,
    aiConfidence: aiOutput.confidence,
    aiIntent: aiOutput.intent,
  });

  const escalate = shouldEscalateChat({
    message,
    aiConfidence: aiOutput.confidence,
    aiShouldEscalate: aiOutput.shouldEscalate,
  });

  if (escalate) {
    await chatRepository.updateSession(sessionId, {
      status: 'escalated',
      detectedIntent: aiOutput.intent,
      escalatedAt: new Date().toISOString(),
    });

    const escalation = await chatRepository.createEscalation({
      tenantId,
      sessionId,
      reason: aiOutput.escalationReason ?? 'low_ai_confidence',
      channel: 'dashboard',
      status: 'pending',
    });

    await notifyChatEscalation({
      tenantId,
      productKey: session.productKey,
      sessionId,
      reason: escalation.reason,
      messagePreview: message,
      pageUrl: session.pageUrl,
    });
  }

  return res.json({
    sessionId,
    reply: aiOutput.reply,
    status: escalate ? 'escalated' : session.status,
    escalated: escalate,
    intent: aiOutput.intent,
    confidence: aiOutput.confidence,
  });
});

chatRouter.post('/escalate', async (req, res) => {
  const { tenantId, sessionId, reason, note } = req.body;

  if (!tenantId || !sessionId || !reason) {
    return res.status(400).json({ error: 'tenantId, sessionId, and reason are required' });
  }

  await chatRepository.updateSession(sessionId, {
    status: 'escalated',
    escalatedAt: new Date().toISOString(),
  });

  const escalation = await chatRepository.createEscalation({
    tenantId,
    sessionId,
    reason,
    channel: 'dashboard',
    status: 'pending',
  });

  await chatRepository.addMessage({
    tenantId,
    sessionId,
    sender: 'system',
    body: note || 'Conversation escalated to human support.',
  });

  await notifyChatEscalation({
    tenantId,
    productKey: 'generic',
    sessionId,
    reason,
    messagePreview: note || 'Manual escalation requested.',
  });

  return res.json({ ok: true, escalationId: escalation.id });
});
```

---

# 18. Welcome Message Logic

```ts
function getWelcomeMessage(productKey: string) {
  switch (productKey) {
    case 'merxus':
      return 'Hi — I can help you understand Merxus AI, answer questions, or connect you with someone from our team.';
    case 'home_advisor':
      return 'Hi — I can help you understand how Workside Home Advisor helps sellers and agents prepare homes for listing.';
    case 'workside_logistics':
      return 'Hi — I can help explain Workside Logistics, supplier tracking, route monitoring, and dispatch workflows.';
    case 'workside_signals':
      return 'Hi — I can help explain Workside Signals and how it supports operational alerts and monitoring.';
    default:
      return 'Hi — how can I help today?';
  }
}
```

---

# 19. Admin Dashboard Requirements

Add a dashboard screen:

```text
/admin/chat
```

## Required Views

### Conversation List

Columns:

- Created
- Product
- Visitor/Lead
- Status
- Intent
- Priority
- Last message
- Escalated?

Filters:

- Product
- Status
- Date range
- Escalated only
- Lead captured

### Conversation Detail

Show:

- Full message history
- Visitor info
- Page URL
- Referrer
- Detected intent
- AI confidence
- Escalation reason
- Internal notes
- Lead fields

Actions:

- Mark contacted
- Assign owner
- Close session
- Create lead
- Send follow-up email
- Send SMS follow-up later

---

# 20. Security Requirements

## Important

- Do not expose OpenAI API keys to frontend.
- Do not allow arbitrary tenantId access without validation in admin routes.
- Sanitize message input.
- Rate-limit chat endpoints.
- Block obvious spam.
- Add CORS allowlist by known domains.
- Do not collect payment card data in chat.
- Do not collect passwords, SSNs, or sensitive data.
- Keep logs privacy-conscious.

## Suggested Rate Limits

```text
POST /api/chat/session: 10 per IP per hour
POST /api/chat/message: 60 per IP per hour
POST /api/chat/escalate: 10 per IP per hour
POST /api/chat/lead: 20 per IP per hour
```

---

# 21. Environment Variables

Add as needed:

```text
OPENAI_API_KEY=
CHAT_ALLOWED_ORIGINS=https://merxus.ai,https://worksideadvisor.com,https://worksidesignals.com
CHAT_DEFAULT_ESCALATION_EMAIL=
CHAT_SLACK_WEBHOOK_URL=
SENDGRID_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_CHAT_ALERT_FROM=
CHAT_ALERT_TO_PHONE=
```

For multi-tenant systems, store notification targets per tenant instead of relying only on global environment variables.

---

# 22. Multi-Tenant Settings

Add tenant-level chat config:

```ts
export interface TenantChatConfig {
  tenantId: string;
  enabled: boolean;
  productKey: string;

  displayName: string;
  welcomeMessage?: string;

  escalationEmail?: string;
  escalationPhone?: string;
  slackWebhookUrl?: string;

  collectLeadName: boolean;
  collectLeadEmail: boolean;
  collectLeadPhone: boolean;
  collectCompany: boolean;

  aiEnabled: boolean;
  humanEscalationEnabled: boolean;

  createdAt: string;
  updatedAt: string;
}
```

---

# 23. Optional Drop-In Script Version

For non-React static sites later, build a script loader:

```html
<script
  src="https://cdn.workside.software/chat-widget.js"
  data-tenant-id="TENANT_ID"
  data-product-key="home_advisor"
  data-api-base-url="https://api.worksideadvisor.com"
></script>
```

This should be a later phase. Start with React component first.

---

# 24. Testing Checklist

## Frontend

- Widget opens and closes.
- Session created only once per visitor.
- Message sends successfully.
- AI response appears.
- Typing indicator works.
- Mobile layout does not cover page CTAs.
- Error state displays cleanly.
- Human escalation button works.

## Backend

- Session creation validates tenantId/productKey.
- Message endpoint stores visitor message.
- AI reply is stored.
- Escalation logic triggers correctly.
- Notification service handles failure without crashing chat.
- Session history returns in correct order.
- Rate limiting works.

## Security

- Invalid tenant cannot read another tenant’s chat.
- Frontend cannot access API keys.
- CORS rejects unknown domains.
- Spam bursts are rate limited.
- Sensitive data warning appears in widget.

---

# 25. Implementation Phases for Codex

## Phase 1 — Backend Models and Repository

Prompt Codex:

```text
Implement the website chat backend data layer.

Create TypeScript types for ChatSession, ChatMessage, ChatLead, and ChatEscalation. Add a chatRepository abstraction with methods:

- createSession
- getSession
- updateSession
- addMessage
- getRecentMessages
- createLead
- createEscalation
- listSessionsForTenant
- getSessionWithMessages

Use the existing project database style. If the project is Firebase-first, implement Firestore collections. If MongoDB is already the primary data store, implement MongoDB collections. Add indexes where appropriate. Keep tenantId required on all records.
```

---

## Phase 2 — Backend Routes

Prompt Codex:

```text
Add Express routes for website chat:

POST /api/chat/session
POST /api/chat/message
GET /api/chat/session/:sessionId
POST /api/chat/escalate
POST /api/chat/lead
POST /api/chat/close

Use the chatRepository abstraction. Validate required fields. Make sure every route enforces tenantId/session ownership. Add safe error handling and do not expose stack traces to the client.
```

---

## Phase 3 — AI Chat Service

Prompt Codex:

```text
Implement aiChatService and chatPromptBuilder for website chat.

The service should accept tenantId, productKey, sessionId, visitor message, recent messages, and page URL. Build a product-aware system prompt. Return a structured object with:

- reply
- intent
- confidence
- shouldEscalate
- escalationReason
- leadFieldsToRequest

Do not invent prices, guarantees, or unsupported claims. Keep replies concise and professional. Never ask users for payment card data, passwords, SSNs, or private keys.
```

---

## Phase 4 — Escalation and Notifications

Prompt Codex:

```text
Implement chatEscalationService and chatNotificationService.

Escalate if the user asks for a human, asks to be called, reports a billing/payment issue, reports a bug/outage, expresses frustration, appears sales-qualified, or if AI confidence is below 0.7.

Notification service should support dashboard-first escalation and optionally Slack webhook, SendGrid email, and Twilio SMS if environment variables or tenant config are present. Notification failures should be logged but should not fail the chat response.
```

---

## Phase 5 — React Chat Widget

Prompt Codex:

```text
Build a reusable React ChatWidget component.

Requirements:
- Floating button bottom-right.
- Opens a clean chat panel.
- Creates chat session on first open.
- Stores visitorId and sessionId in localStorage.
- Sends messages to /api/chat/message.
- Shows AI replies.
- Shows typing indicator.
- Includes Talk to Human button.
- Includes small safety note: Do not enter passwords or payment information.
- Is responsive on mobile.
- Uses existing project styling conventions and Tailwind if available.

Files:
- ChatWidget.tsx
- ChatPanel.tsx
- ChatMessageList.tsx
- ChatInput.tsx
- LeadCaptureForm.tsx
- chatApi.ts
- types.ts
```

---

## Phase 6 — Admin Dashboard

Prompt Codex:

```text
Add an admin chat dashboard.

Create /admin/chat with:
- Conversation list
- Filters by product, status, escalated, date range
- Conversation detail view
- Full message history
- Visitor/lead info
- Escalation details
- Actions to mark contacted, assign owner, close session, and create/update lead

Use existing admin layout and authentication. Enforce tenant-aware access.
```

---

## Phase 7 — Deployment Config

Prompt Codex:

```text
Add required environment variable documentation and deployment notes for website chat.

Include:
- OPENAI_API_KEY
- CHAT_ALLOWED_ORIGINS
- CHAT_DEFAULT_ESCALATION_EMAIL
- CHAT_SLACK_WEBHOOK_URL
- SENDGRID_API_KEY
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_CHAT_ALERT_FROM
- CHAT_ALERT_TO_PHONE

Ensure Cloud Run deployment does not expose secrets to frontend. Add CORS allowlist support for approved website domains.
```

---

# 26. Final Recommendation

Start with Merxus AI or Workside Home Advisor as the first production implementation. The same system can then be reused across other Workside properties.

The MVP should focus on:

1. Clean widget
2. Reliable AI replies
3. Lead capture
4. Escalation
5. Admin visibility

Do not overbuild human live-chat dashboards until the first version proves that visitors are using the widget and qualified conversations are being captured.


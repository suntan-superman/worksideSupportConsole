Implementation Plan: Website Chat Integration
Objective

Add a live chat widget to:

Merxus AI web app
Workside Home Advisor web app

The widget should allow visitors to start a chat for sales or support. Conversations should create support sessions in the Merxus /support backend and appear in the Workside Support Console for agents to handle.

Phase 1 — Define the Chat Entry Contract

Each web app must send enough context so the backend can create a valid support session.

Required payload:

{
  product: "merxus" | "home_advisor",
  tenantId?: string,
  tenantType?: "platform" | "office" | "restaurant" | "real_estate" | "seller" | "agent" | "provider",
  source: "website_chat",
  sourceUrl: window.location.href,
  visitorId: string,
  initialIntent?: "sales" | "support" | "general",
  initialMessage: string
}

Important distinction:

Public marketing pages may not have a tenant yet.
Logged-in customer portals should pass tenant/customer context.
Backend must support both:
platform-level sales/support chat
tenant/customer-specific chat
Phase 2 — Add Public Chat Session Endpoint

The existing /support endpoints are internal-agent oriented.

For website visitors, add a public-safe endpoint:

POST /chat/public/session
POST /chat/public/session/:sessionId/message
GET  /chat/public/session/:sessionId/messages

Do not expose /support/* to public visitors.

The /chat/public/* routes should:

create visitor sessions
store messages
classify intent
trigger lead capture
optionally AI-respond
optionally escalate to human
make session visible inside Support Console
Phase 3 — Backend Session Creation Rules

For Merxus AI public website:

product = "merxus"
tenantId = "merxus-platform"
tenantType = "platform"
source = "website_chat"

For Home Advisor public website:

product = "home_advisor"
tenantId = "home-advisor-platform"
tenantType = "platform"
source = "website_chat"

For logged-in app users:

tenantId = actual customer/seller/agent/provider id
tenantType = actual type

This prevents the previous issue where sessions entered the queue with undefined tenant metadata.

Phase 4 — Build Reusable Chat Widget

Create a shared widget package or copy the same component into both apps initially.

Recommended component:

<WebsiteChatWidget
  product="merxus"
  tenantId="merxus-platform"
  tenantType="platform"
  mode="sales_support"
/>

For Home Advisor:

<WebsiteChatWidget
  product="home_advisor"
  tenantId="home-advisor-platform"
  tenantType="platform"
  mode="seller_agent_support"
/>

Widget features:

floating chat bubble
welcome message
message thread
lead capture prompts
typing/loading state
“talk to a person” button
after-hours message capture
graceful error state
Phase 5 — Lead Capture Flow

Do not require name/email before the first message.

Recommended sequence:

Visitor opens chat
Visitor asks question
AI/support system responds
After 1–2 messages, prompt:
Before we continue, can I grab your name and email in case we get disconnected or need to follow up?

Canonical fields:

leadName
leadEmail
leadPhone
leadCaptured
lead.missingFields

For sales chats:

name + email required
phone optional

For support chats:

name + email required
phone recommended
Phase 6 — Support Console Visibility

New website chats should appear in Support Console with:

source = "website_chat"
product = "merxus" | "home_advisor"
tenantId = "merxus-platform" | "home-advisor-platform"
status = "active_ai" | "escalated"
intent = "sales" | "support" | "general"
leadCaptured = true | false

Add filters:

Product
Source = Website Chat
Intent = Sales / Support
Lead captured
Status
Phase 7 — Human Takeover Flow

When visitor clicks:

Talk to a person

Backend should:

Validate session
Mark transfer requested
Set status to escalated
Notify support console
Continue polling until agent accepts

Frontend message:

I’m notifying our team now. Someone will join the chat as soon as possible.

If no agent is available:

Our team may be offline right now, but I can take your message and make sure someone follows up.
Phase 8 — Polling-Based Updates

Use polling for now, not WebSockets.

Public chat widget:

setInterval(fetchMessages, 5000)

Support Console already uses polling.

This keeps the system stable with Cloud Run.

Phase 9 — Product-Specific Behavior
Merxus AI Chat

Primary intents:

pricing
setup
AI phone assistant
reviews
SMS/Twilio
integrations
support

Suggested opening:

Hi — I’m the Merxus assistant. Are you looking for help with your account, or are you interested in learning how Merxus AI works?
Home Advisor Chat

Primary intents:

seller help
agent help
photo enhancements
property report
provider marketplace
support

Suggested opening:

Hi — I can help with property reports, photo enhancements, seller readiness, or connecting with support. What can I help you with?
Phase 10 — Testing Plan
Test A — Merxus Sales Visitor
Open Merxus public site
Start chat
Ask pricing question
Provide name/email
Click talk to person
Confirm session appears in Support Console
Agent accepts
Agent replies
Visitor sees reply
Agent closes session
Test B — Home Advisor Seller Visitor
Open Home Advisor site
Ask about improving property photos
Provide lead info
Request follow-up
Confirm inquiry appears in Support Console
Test C — Missing Lead
Start chat
Ask for human
Refuse email
Confirm backend marks lead incomplete
Confirm close is blocked until required lead fields captured or no-follow-up policy is used
Test D — After Hours
Simulate business closed
Start chat
Ask support question
Confirm inquiry capture flow starts
Confirm Support Console shows after-hours inquiry
Immediate Codex Tasks
Backend Codex Prompt
Implement public website chat endpoints for Merxus AI and Home Advisor.

Add routes:
POST /chat/public/session
POST /chat/public/session/:sessionId/message
GET /chat/public/session/:sessionId/messages
POST /chat/public/session/:sessionId/request-human

These routes are public visitor-facing and must not require Firebase support-agent auth.

They must create support-visible sessions with valid product, tenantId, tenantType, source, sourceUrl, visitorId, lead fields, intent, status, and messages.

Use tenantId "merxus-platform" for Merxus public website chats and "home-advisor-platform" for Home Advisor public website chats unless a logged-in app tenant is provided.

Do not expose /support routes publicly. /support remains internal-agent only.

Ensure created sessions appear in the existing Support Console /support/sessions list and can be taken over by agents.
Frontend Codex Prompt — Merxus Web
Add a floating WebsiteChatWidget to the Merxus AI web app.

The widget should create public chat sessions using POST /chat/public/session with product "merxus", tenantId "merxus-platform", tenantType "platform", source "website_chat", and sourceUrl.

It should support sending messages, polling messages every 5 seconds, capturing name/email, and requesting a human agent.

Keep the design clean, professional, and lightweight.
Frontend Codex Prompt — Home Advisor Web
Add a floating WebsiteChatWidget to the Home Advisor web app.

The widget should create public chat sessions using POST /chat/public/session with product "home_advisor", tenantId "home-advisor-platform", tenantType "platform", source "website_chat", and sourceUrl.

It should support seller/agent/provider inquiries, sending messages, polling messages every 5 seconds, capturing name/email, and requesting a human agent.

Keep the design aligned with the Home Advisor UI.
Recommended Order
Backend public chat endpoints
Basic widget in Merxus AI
Verify Support Console visibility
Agent takeover test
Add Home Advisor widget
Refine lead/inquiry capture
Add after-hours behavior
Deploy both sites
Run end-to-end QA

This is the cleanest path: backend first, Merxus test second, Home Advisor third.
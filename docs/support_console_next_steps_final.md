Workside Support Console — Final Next Steps Plan
## Based on Codex Assessment (Production Readiness Track)

---

# 🎯 Executive Summary

The system is **functionally complete** and **architecturally correct**, but not yet production-ready.

Current state:

- Backend: strong structure, needs contract hardening
- Frontend: fully wired, strong UX
- Integration: working, but not yet proven under all conditions

👉 The system is now in **Validation + Hardening Phase**

---

# 🚨 CORE BLOCKERS (P0 — MUST FIX)

---

## 🔴 1. Session Creation + Tenant Integrity

### Problem
Sessions are entering support queue without valid tenant metadata.

### Fix

Backend must guarantee:

```ts
tenantId
tenantType
product

ALWAYS exist.

Required Changes
Reject sessions without tenant context

OR mark as:

tenantContextMissing: true
actionable: false
requiredAction: repair_session_tenant
Prevent these from appearing in normal support queue
Success Criteria

No session appears with:

Tenant: undefined
🔴 2. Lead Capture Canonicalization
Problem

Lead data exists in inconsistent fields.

Example:

name shown in UI
but NOT stored in canonical leadName
Fix

Backend must ALWAYS populate:

leadName
leadEmail
leadPhone
leadCaptured
missingFields
Required Behavior
If email required → AI must request it

If missing → return:

missingFields: ["email"]
Success Criteria
UI loads lead from backend (no inference)
Close enforcement uses backend data only
🔴 3. Queue Filtering + Assignment Contract
Problem

Assigned filtering is inconsistent and fuzzy.

Fix

Replace fuzzy matching:

haystack.includes(...)

WITH:

assignedToUserId === value
Add support for:
assignedTo=unassigned
assignedTo=<userId>
Success Criteria
No stale filters
Assigned filter behaves deterministically
🔴 4. API Contract Lock (CRITICAL)
Problem

Frontend still compensates for inconsistent responses.

Fix

LOCK contract:

Sessions List
{
  sessions: ChatSession[]
}
Session Detail
{
  session,
  messages,
  inquiry?,
  audit?
}
Action
Remove all fallback parsing
Remove defensive shape logic
Success Criteria
Frontend trusts backend 100%
No "guessing" logic remains
🔴 5. Route-Level Test Coverage
Problem

Backend logic exists but is not proven via tests.

Add Tests For:
transfer without inquiry → blocked
reply before takeover → blocked
close without lead → blocked
unauthorized tenant → blocked
valid flow → succeeds
Success Criteria
All support routes have integration tests
Expected errors return exact codes + payloads
🟡 P1 — HIGH VALUE IMPROVEMENTS
1. Audit Logging Fix
Problem

Logs show:

audit logging failed
Fix
Ensure all audit objects include required fields
Prevent undefined access
2. Assignment System Cleanup
Standardize on userId
Ensure all endpoints return consistent assignment data
3. Admin Session Repair UI

You already have:

PATCH /support/admin/sessions/:id/tenant
Add frontend UI:
super_admin-only
fix broken sessions
assign correct tenant
4. Lead UX Improvement

Display:

Missing: Email

next to field — not just blocking error

5. Transcript Quality
remove internal messages
add timestamps
improve readability
🟢 P2 — COMPLETION + SCALE
1. Dashboard Metrics

From:

/support/metrics

Display:

active chats
waiting
high urgency
leads today
resolved
2. Inquiry Queue

Dedicated view:

list
assign
resolve
3. Leads View
track follow-ups
link sessions
4. Audit Timeline

Per session:

Chat started
Transfer requested
Agent joined
Lead captured
Closed
5. Pagination

Add:

cursor or page-based navigation
6. Realtime (future)

Keep polling for now

Upgrade later to:

SSE
Firebase
🧪 VALIDATION PLAN (DO THIS NEXT)
1. Happy Path
AI → transfer → accept → reply → lead → inquiry → close
2. Failure Path
reply before takeover
close without lead
transfer without inquiry
3. Multi-session test
switch sessions rapidly
ensure no state bleed
4. Role test
super_admin
support_agent
viewer
🎯 DEFINITION OF DONE
Backend
tenant always valid
lead always canonical
enforcement cannot be bypassed
tests pass
Frontend
no inference logic
no fallback parsing
errors mapped cleanly
UI reflects backend truth
End-to-End
new session appears correctly
agent can fully process session
no broken flows
no silent failures
🚀 NEXT 3-DAY EXECUTION PLAN
Day 1 — Queue + Contract
fix session creation
fix tenant context
lock API shapes
Day 2 — Lead + Assignment
canonical lead fields
fix assignment logic
add tests
Day 3 — Validation + QA
run all scenarios
fix edge cases
stabilize
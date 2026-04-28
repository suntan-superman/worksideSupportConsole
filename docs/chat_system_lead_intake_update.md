
# FULL CHAT SYSTEM – LEAD CAPTURE + INTAKE ENFORCEMENT (CODEX READY)

## 🔒 NON-NEGOTIABLE REQUIREMENTS

1. ALWAYS capture name + email before session ends or escalation
2. ALWAYS capture inquiry details if no human is available
3. NEVER allow anonymous session to close

---

## 🧠 LEAD CAPTURE SYSTEM

### Trigger Logic

```ts
if (!session.leadCaptured && messageCount >= 2) {
  promptForContactInfo()
}
```

### Prompt

"Before I continue, can I grab your name and email in case we get disconnected or need to follow up?"

---

### Extraction Logic

```ts
function extractEmail(text: string) {
  const regex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
  return text.match(regex)?.[0]
}

function extractName(text: string) {
  // simple heuristic or AI extraction
}
```

---

### Schema Update

```ts
ChatSession {
  _id
  tenantId
  name?: string
  email?: string
  phone?: string
  leadCaptured: boolean
  status: 'ai' | 'human' | 'closed'
  createdAt
}
```

---

### Enforcement Middleware

```ts
function enforceLeadCapture(session) {
  if (!session.leadCaptured) {
    throw new Error("LEAD_CAPTURE_REQUIRED")
  }
}
```

Call this BEFORE:
- session close
- escalation
- inactivity timeout

---

## 🕒 BUSINESS HOURS ENGINE

```ts
BusinessHours {
  timezone: string
  hours: {
    mon: ['08:00','17:00'],
    tue: ['08:00','17:00'],
    wed: ['08:00','17:00'],
    thu: ['08:00','17:00'],
    fri: ['08:00','17:00']
  }
}
```

---

### Availability Check

```ts
function isBusinessOpen(hoursConfig) {
  // compare current time vs config
}
```

---

## 🧾 INQUIRY INTAKE SYSTEM (AFTER HOURS)

### Trigger

```ts
if (!isBusinessOpen()) {
  startInquiryFlow()
}
```

---

### Prompt

"It looks like our team is currently offline, but I can take a message and make sure someone follows up."

"Can you briefly describe your request or issue?"

---

## 💾 Inquiry Schema

```ts
ChatInquiry {
  sessionId
  name
  email
  messageSummary
  urgency: 'low' | 'medium' | 'high'
  intent: 'sales' | 'support' | 'booking' | 'general'
  status: 'pending' | 'assigned' | 'resolved'
  createdAt
}
```

---

## 🧠 AI Summarization

```ts
function summarizeConversation(messages) {
  // call AI model
}
```

---

## 🚨 Notification System

### Channels:
- SMS (Twilio)
- Slack
- Email

---

### Example

"New inquiry from John (john@email.com): Needs help scheduling service tomorrow."

---

## 🔁 FINAL FLOW

### During Hours:
- Chat starts
- AI responds
- Capture lead
- Escalate if needed

### After Hours:
- Chat starts
- AI assists
- Capture lead
- Capture inquiry
- Summarize
- Store
- Notify team
- Confirm to user

---

## ✅ FINAL ENFORCEMENT RULES

- No lead → no close
- No inquiry (after hours) → no close
- Always summarize before storing
- Always notify team

---

END

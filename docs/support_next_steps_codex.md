
# Workside Support Console — Next Steps (Post /support Backend Implementation)

## 🎯 CURRENT STATE (IMPORTANT)

You have successfully:
- Built isolated `/support` module inside Merxus backend
- Implemented enforcement (lead + inquiry)
- Added transfer lifecycle + state machine
- Added audit logging
- Added Firebase auth + tenant enforcement
- Passed unit tests

👉 This is a MAJOR milestone. You now have a production-grade backend layer.

---

# 🚀 OBJECTIVE (NEXT PHASE)

Connect the Support Console frontend → /support backend endpoints  
AND remove all fallback/guessing logic.

---

# 🔴 PHASE 1 — FRONTEND → BACKEND WIRING (CRITICAL)

## Step 1 — Remove Fallback Endpoints

Replace all endpoint guessing logic.

```ts
const API_BASE = import.meta.env.VITE_API_BASE_URL
const SUPPORT_BASE = `${API_BASE}/support`
```

---

## Step 2 — Wire Sessions List

GET /support/sessions

```ts
await api.get('/support/sessions', { params: { tenantId, product } })
```

---

## Step 3 — Wire Session Detail

GET /support/sessions/:id

---

## Step 4 — Request Transfer

POST /support/sessions/:id/request-transfer

---

## Step 5 — Takeover

POST /support/sessions/:id/takeover

---

## Step 6 — Reply

POST /support/sessions/:id/reply

---

## Step 7 — Close

POST /support/sessions/:id/close

---

## Step 8 — Lead

PATCH /support/sessions/:id/lead

---

## Step 9 — Inquiry

POST /support/sessions/:id/inquiry

---

# 🟡 PHASE 2 — ERROR HANDLING

Use backend codes only.

---

# 🟢 PHASE 3 — REALTIME

wss://api.merxus.ai/support/realtime

---

# 🧪 TEST FLOW

1. Load sessions
2. Open session
3. Request transfer
4. Takeover
5. Reply
6. Close

---

# 🚀 FINAL

You are now in integration phase. Lock the contract and remove all fallback logic.

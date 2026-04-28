# Support Console — Realtime Fix (Disable WebSockets + Add Polling)

## 🎯 Objective

Disable unstable WebSocket realtime connection (Cloud Run limitation) and replace it with a stable polling-based update system.

---

# 🚨 Problem

WebSocket connections to:

wss://api.merxus.ai/support/realtime

are failing and reconnecting continuously.

This is expected behavior on Cloud Run and cannot be reliably fixed.

---

# ✅ Solution

Replace WebSocket realtime with polling every 5 seconds.

---

# 🔴 STEP 1 — Disable WebSocket Connection

Find the realtime connection logic (likely in):

- realtime.js
- useRealtime.ts
- or similar

---

## Remove or comment out:

```ts
const socket = new WebSocket(...)
socket.onopen = ...
socket.onmessage = ...
socket.onerror = ...
socket.onclose = ...
Also remove:
reconnect loops
exponential backoff logic
heartbeat/ping logic
🟢 STEP 2 — Add Polling

In your main sessions component (or global data loader):

Example (React):
useEffect(() => {
  let isMounted = true;

  const fetchData = async () => {
    try {
      await fetchSessions();
      if (selectedSessionId) {
        await fetchSessionDetail(selectedSessionId);
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  };

  // initial load
  fetchData();

  const interval = setInterval(() => {
    if (isMounted) {
      fetchData();
    }
  }, 5000);

  return () => {
    isMounted = false;
    clearInterval(interval);
  };
}, [selectedSessionId]);
⚠️ IMPORTANT RULES
1. Prevent duplicate intervals

Do NOT nest polling inside other effects incorrectly.

2. Always clear interval
return () => clearInterval(interval);
3. Do not over-poll

Use:

5000 ms (recommended)

NOT:

1000 ms ❌
🟡 STEP 3 — Update UI Status

Replace:

Realtime reconnecting

With:

Live updates every 5 seconds

OR:

Connected (Polling Mode)
🟢 STEP 4 — Remove WebSocket Env Dependency

Remove or ignore:

VITE_SUPPORT_REALTIME_URL

Keep:

VITE_API_BASE_URL=https://api.merxus.ai

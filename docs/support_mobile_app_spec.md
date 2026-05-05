Support Console Mobile App (Expo React Native)

Now let’s design your mobile app the right way.

🎯 GOAL

Minimal v1 that supports:

✔ Toggle availability
✔ Receive transfer alerts
✔ Accept transfers
✔ Chat with visitor
✔ Close / escalate
✔ (Optional later) transcript
🧠 Architecture
Mobile App (Expo)
        ↓
Merxus Backend (/support)
        ↓
Same APIs as web

👉 NO new backend needed
👉 Reuse everything you built

🏗️ App Structure
mobile-support-app/
  app/
    screens/
      LoginScreen.tsx
      DashboardScreen.tsx
      ChatScreen.tsx
    components/
      SessionList.tsx
      MessageList.tsx
      MessageInput.tsx
      AvailabilityToggle.tsx
    services/
      api.ts
      auth.ts
    hooks/
      usePolling.ts
      useAuth.ts
📱 Screen Design
🔐 1. Login Screen
Email / Password
OTP (same as web)
Store Firebase token
🟢 2. Dashboard (Main Screen)
Top Bar
[ Available 🔘 ]  [ Refresh ]
Session List

Each item:

[ Customer Name ]
Merxus AI | Medium urgency
Unassigned / Assigned to you
Behavior
Tap → opens chat
Poll every 5 seconds
💬 3. Chat Screen
Header
Customer Name
Status: Waiting / Active / AI
Messages
chat bubbles
scrollable
newest at bottom
Input
[ Type message... ] [ Send ]
Actions

Buttons:

Accept Transfer
Close
Escalate
🔔 Real-Time Strategy
v1:

👉 Polling (same as web)

setInterval(fetchSessions, 5000)
v2:

👉 Push notifications

🔔 Notifications (IMPORTANT)

Use:

Expo Notifications

Trigger when:

new transfer assigned
new message received
🧠 Core Hooks
usePolling
useEffect(() => {
  const interval = setInterval(fetchData, 5000);
  return () => clearInterval(interval);
}, []);
useAuth
get Firebase token
attach to API
🔌 API Layer

Reuse:

/support/sessions
/support/sessions/:id
/support/sessions/:id/reply
/support/sessions/:id/takeover
/support/sessions/:id/close
/support/users/me/availability
/support/users/me/heartbeat
🟢 Availability Toggle
<Toggle
  value={available}
  onChange={(val) => updateAvailability(val)}
/>
⚠️ Critical Mobile Behavior
1. Heartbeat

Run:

every 30 seconds while app is active
2. Background behavior
If app backgrounded → mark unavailable OR pause heartbeat
3. Session updates
Preserve open chat
Don’t reset UI on polling
🎯 MVP Flow
Agent
Open app
→ Set Available
→ Receive alert
→ Tap session
→ Accept transfer
→ Reply
→ Close
That’s it.
🚀 Phase 2 (later)
Push notifications
Transcript send
Multi-session tabs
Offline handling
Attachments
Voice notes
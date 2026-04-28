Tailwind Setup (You Prefer This)
tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
}
index.css
@tailwind base;
@tailwind components;
@tailwind utilities;
4️⃣ Project Structure
src/
  app/
  components/
  pages/
    Dashboard/
    Sessions/
    SessionDetail/
    Inquiries/
    Leads/
    Audit/
  services/
    api.ts
    chat.ts
  auth/
    firebase.ts
    useAuth.ts
  hooks/
  types/
  routes/
5️⃣ Environment Variables

Create:

.env.local
VITE_API_BASE_URL=https://api.merxus.ai

VITE_FIREBASE_API_KEY=YOUR_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_DOMAIN
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_APP_ID=YOUR_APP_ID
6️⃣ Firebase Auth Setup (CRITICAL)
In Firebase Console:

Use your existing Firebase project (same as Merxus if possible).

Enable:
Email/Password
(Optional) Google login
src/auth/firebase.ts
import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
🔐 Roles via Custom Claims

You will assign roles like:

role: 'admin' | 'support' | 'dispatcher'

Set via Firebase Admin SDK (backend).

7️⃣ API Client (Connect to Chat Engine)
src/services/api.ts
import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

api.interceptors.request.use(async (config) => {
  const token = await window.firebaseAuth?.currentUser?.getIdToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

export default api
8️⃣ Basic Routing
src/main.tsx
import { BrowserRouter } from "react-router-dom"

<BrowserRouter>
  <App />
</BrowserRouter>
src/routes/index.tsx
import { Routes, Route } from "react-router-dom"
import Dashboard from "../pages/Dashboard"
import Sessions from "../pages/Sessions"

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/sessions" element={<Sessions />} />
    </Routes>
  )
}
9️⃣ Auth Gate (Required)
src/auth/useAuth.ts
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "./firebase"

export function listenAuth(callback: any) {
  return onAuthStateChanged(auth, callback)
}
Protect App
if (!user) {
  return <LoginScreen />
}
🔟 Core Pages (Build Order)
Phase 1 (MVP)
Dashboard
Sessions List
Session Detail
Reply + Takeover
Phase 2
Inquiry Queue
Lead View
Phase 3
Audit Logs
Metrics
11️⃣ WebSocket / Real-Time (Later Step)

You’ll connect to:

wss://api.merxus.ai/support/realtime

Start with polling → upgrade later.

12️⃣ Domain Setup

You said:

👉 support.worksidesoftware.com

DNS (Cloudflare / Porkbun)

Add:

CNAME
support → your-netlify-site.netlify.app
Netlify Deploy
npm run build

Deploy /dist

Netlify Settings
Build command: npm run build
Publish dir: dist
13️⃣ Security Rules (DO NOT SKIP)
Require Firebase token on every request
Backend verifies token
Backend enforces:
role
tenant access
product access
14️⃣ First Test Flow

After setup:

Login to console
Open /sessions

Hit API:

GET /support/sessions
Click session
Reply
Confirm message appears in frontend chat widget
🔥 Reality Check (Important)

You now have:

✅ Shared Chat Engine
✅ Multi-product ingestion
✅ Unified support console
✅ Lead + inquiry capture

This is already:
👉 enterprise-grade architecture
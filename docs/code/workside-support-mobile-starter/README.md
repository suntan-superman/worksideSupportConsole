# Workside Support Mobile — Expo Starter

Mobile companion app for Workside Support Console.

## v1 Scope

- Firebase email/password login
- Support session list
- Chat detail
- Accept transfer
- Reply to visitor
- Close / escalate session
- Toggle availability
- Heartbeat while available
- Polling every 5 seconds
- Expo notification registration placeholder

## Setup

```bash
npm install
npx expo start
```

Copy `.env.example` to `.env` and fill Firebase values.

## Required Backend Routes

```txt
GET    /support/sessions
GET    /support/sessions/:id
POST   /support/sessions/:id/takeover
POST   /support/sessions/:id/reply
POST   /support/sessions/:id/close
POST   /support/sessions/:id/request-transfer
GET    /support/users/me/availability
POST   /support/users/me/availability
POST   /support/users/me/heartbeat
```

## Production Notes

- Backend remains authoritative.
- Mobile should never bypass backend lead/inquiry/transfer enforcement.
- Polling is v1; push notifications can be added after Expo tokens are registered backend-side.

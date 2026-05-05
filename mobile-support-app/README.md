# Workside Support Mobile

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
- Local transfer alerts while polling

## Setup

```bash
npm install
npx expo start
```

Copy `.env.example` to `.env` and fill Firebase values.

From the repository root you can also run:

```bash
npm run mobile:start
npm run mobile:typecheck
```

## Login

The app supports the same auth paths as the support console:

- Firebase email/password
- Email one-time code via `/auth/otp/send` and `/auth/otp/verify`

Firebase ID tokens are preferred. If the OTP endpoint returns an already-minted bearer token instead of a Firebase custom token, the app stores that token and sends it as `Authorization: Bearer <token>`.

## Transfer Alerts

v1 uses polling. When a newly waiting transfer appears while the app is open, the app schedules a local Expo notification with sound. Backend SMS remains the authoritative out-of-app alert path.

The SMS notification should not include direct links for now. The mobile app v1 is intentionally minimal: availability, queue, accept transfer, chat, and close/escalate.

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
- Heartbeat runs only while availability is set to available and the app is active.

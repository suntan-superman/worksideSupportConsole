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

### Android Firebase Auth Troubleshooting

The Android build uses the Expo/JS Firebase config from `EXPO_PUBLIC_FIREBASE_*` or the parent web `VITE_FIREBASE_*` values. It does not currently use a native `google-services.json`.

If iOS can sign in but a physical Android device cannot:

1. Rebuild or restart Android after Firebase env changes. The config is read when Expo starts and can be stale in an installed development build.
2. Confirm the Android package is registered in Firebase/Google Cloud wherever API key restrictions are configured: `com.worksidesoftware.support`.
3. Check the app alert or device console for the Firebase code. The login screen now includes the code, project id, auth domain, and masked app id suffix.
4. Common codes:
   - `auth/api-key-not-valid` or `auth/app-not-authorized`: API key restriction or app registration mismatch.
   - `auth/network-request-failed`: device/network/VPN/private DNS issue reaching Firebase.
   - `auth/invalid-credential`: Firebase rejected the email/password itself.

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

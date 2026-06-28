# Mobile Auth Security

Date: 2026-06-28

## Goal

Mobile bearer tokens must be stored using platform-backed secure storage. AsyncStorage is acceptable for preferences, but not for tokens.

## Policy

- Store Firebase ID tokens and fallback bearer tokens in Expo SecureStore.
- Keep non-sensitive preferences in AsyncStorage: dark mode, queue filter, notification preference, remembered email.
- On startup, migrate any legacy `support_auth_token` value from AsyncStorage into SecureStore, then remove the AsyncStorage token.
- On logout, clear SecureStore token and non-sensitive session metadata.
- Do not log tokens.
- Do not show raw tokens or raw auth claims in production UI.

## Current Mobile Keys

Sensitive:

- `support_auth_token`

Non-sensitive:

- `support_user_email`
- `support_mobile_remember_email`
- `support_mobile_remember_enabled`
- `support_mobile_dark_mode`
- `support_mobile_notifications_enabled`
- `support_mobile_queue_filter`

## Production Follow-Up

The settings screen currently exposes client-side Firebase account deletion. For an internal support app, prefer admin-controlled deactivation over self-service account deletion in production builds.

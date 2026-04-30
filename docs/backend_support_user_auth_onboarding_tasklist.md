# Backend Tasklist: Support User Auth, Invites, OTP, and Notifications

## Purpose

Add a professional account lifecycle for support console users:

1. Invite newly created support users.
2. Let users set or reset their password.
3. Support optional one-time-code login.
4. Notify users when roles or access change.
5. Use email and SMS channels consistently through existing SendGrid/SMS capabilities.

The frontend has controls wired for these routes.

## Frontend Entry Points

### Login Page

- Password sign-in remains Firebase email/password.
- `Forgot password?` calls Firebase password reset from the frontend.
- `One-time code` mode calls backend OTP endpoints:
  - `POST /auth/otp/send`
  - `POST /auth/otp/verify`

### Super-Admin User Table

Each support user row has:

- `Invite`
- `Reset`
- `Notify`

These call:

- `POST /support/admin/users/:id/invite`
- `POST /support/admin/users/:id/reset-password`
- `POST /support/admin/users/:id/notify-role-change`

## Phase 1: Support User Auth Linkage

- [ ] Ensure each support user can be linked to an auth account by email.
- [ ] Store auth provider id or Firebase UID on the support user record when available.
- [ ] Treat email as the shared identity key across Merxus app access and Support Console access.
- [ ] If the email already exists as a Merxus/Firebase user, link the support user record to the existing UID instead of creating a duplicate auth account.
- [ ] Do not attempt to create a second Firebase user with the same email inside the same Firebase project.
- [ ] If separate Firebase projects are used per app, document whether support console users should authenticate against the same shared project or a dedicated support project.
- [ ] On support user create, either:
  - create a disabled/pending auth user, or
  - create/link the auth user when invite is sent.
- [ ] Keep custom claims aligned with support user role/access:
  - `role`
  - `supportRole`
  - allowed products
  - allowed tenants/customers
  - departments
- [ ] Refresh or invalidate claims after role/access updates.

## Phase 2: Invite Flow

### Route

```http
POST /support/admin/users/:id/invite
```

### Backend Behavior

- [ ] Require `super_admin`.
- [ ] Load support user.
- [ ] Verify user is active.
- [ ] Verify email exists.
- [ ] Create/link auth user.
- [ ] Generate password setup link.
- [ ] Send invite email through SendGrid.
- [ ] Send invite/welcome automatically after support user creation when requested by frontend/backend policy.
- [ ] Invite email should let the user set an initial password when no password is already configured.
- [ ] If the email already belongs to an existing Merxus user, send a welcome/access-added email instead of a duplicate account invite.
- [ ] Optionally send SMS notice when phone exists and SMS is enabled.
- [ ] Store invite metadata:
  - `inviteSentAt`
  - `inviteSentBy`
  - `inviteStatus`
- [ ] Audit `support_user_invite_sent`.

### Response

```json
{
  "ok": true,
  "user": {},
  "invite": {
    "sentAt": "2026-04-29T00:00:00.000Z",
    "email": "agent@example.com",
    "smsAttempted": true,
    "smsSent": true
  }
}
```

## Phase 3: Admin Password Reset

### Route

```http
POST /support/admin/users/:id/reset-password
```

### Backend Behavior

- [ ] Require `super_admin`.
- [ ] Load support user.
- [ ] Verify email exists.
- [ ] Generate password reset link through Firebase/Admin SDK or equivalent auth provider.
- [ ] Send reset email through SendGrid or provider email.
- [ ] Audit `support_user_password_reset_sent`.

### Response

```json
{
  "ok": true,
  "passwordReset": {
    "sentAt": "2026-04-29T00:00:00.000Z",
    "email": "agent@example.com"
  }
}
```

## Phase 4: Role/Access Change Notification

### Route

```http
POST /support/admin/users/:id/notify-role-change
```

### Backend Behavior

- [ ] Require `super_admin`.
- [ ] Load support user.
- [ ] Send informational email summarizing current access:
  - role
  - departments
  - allowed products
  - allowed tenants/customers
- [ ] Optionally send SMS if phone exists and SMS is enabled.
- [ ] Audit `support_user_role_notice_sent`.

### Response

```json
{
  "ok": true,
  "notification": {
    "sentAt": "2026-04-29T00:00:00.000Z",
    "emailSent": true,
    "smsAttempted": true,
    "smsSent": true
  }
}
```

## Phase 5: OTP Login

### Firebase Custom Token IAM Requirement

The OTP verify route must mint a token that the frontend can use with the support API. If the backend uses Firebase Admin SDK custom tokens, the runtime service account needs permission to sign service account blobs.

- [ ] Identify the backend runtime service account used in Cloud Run/App Engine/Cloud Functions.
- [ ] Grant that service account `roles/iam.serviceAccountTokenCreator` on the service account used for Firebase custom token signing.
- [ ] Verify the service account has `iam.serviceAccounts.signBlob`.
- [ ] Confirm `POST /auth/otp/verify` no longer returns `iam.serviceAccounts.signBlob denied`.

Typical permission failure:

```text
Permission 'iam.serviceAccounts.signBlob' denied
```

This means the OTP code may have been valid, but the backend could not issue the login token.

### Send OTP

```http
POST /auth/otp/send
```

Request:

```json
{
  "email": "agent@example.com",
  "purpose": "support_console_login"
}
```

Behavior:

- [ ] Verify email belongs to an active support user.
- [ ] Rate limit by email and IP.
- [ ] Generate short-lived OTP.
- [ ] Store hashed OTP with expiration.
- [ ] Send OTP email through SendGrid.
- [ ] Optionally send OTP SMS when phone exists and policy allows it.
- [ ] Audit `support_login_otp_sent`.
- [ ] Do not reveal whether unknown emails exist.

Response:

```json
{
  "ok": true
}
```

### Verify OTP

```http
POST /auth/otp/verify
```

Request:

```json
{
  "email": "agent@example.com",
  "code": "123456",
  "purpose": "support_console_login"
}
```

Behavior:

- [ ] Verify OTP hash and expiration.
- [ ] Enforce attempt limits.
- [ ] Verify support user is active.
- [ ] Mint Firebase custom token or backend-compatible auth token.
- [ ] Include/refresh support custom claims.
- [ ] Invalidate OTP after successful use.
- [ ] Audit `support_login_otp_verified`.

Response:

```json
{
  "ok": true,
  "idToken": "firebase-id-token"
}
```

Preferred response is a Firebase ID token accepted by the support API.

If the backend returns a Firebase custom token instead, use:

```json
{
  "ok": true,
  "customToken": "firebase-custom-token"
}
```

The frontend will exchange `customToken`, `firebaseCustomToken`, or `data.customToken` with Firebase using `signInWithCustomToken`.

The frontend also accepts backend-compatible bearer tokens in `token`, `idToken`, `firebaseIdToken`, or `data.token`.

### OTP Verify Failure Handling

- [ ] Do not return a generic 502 for known token issuance failures.
- [ ] Return a structured error such as:

```json
{
  "ok": false,
  "error": "Login code was valid, but the backend could not issue a login token.",
  "code": "OTP_TOKEN_ISSUE_FAILED",
  "requiredAction": "contact_admin"
}
```

- [ ] Log the internal Firebase/Admin SDK error server-side with enough detail to diagnose IAM or service account configuration.

## Phase 6: Error Contract

All expected errors should return:

```json
{
  "ok": false,
  "error": "Human-readable message.",
  "code": "CANONICAL_ERROR_CODE",
  "requiredAction": "frontend_action_hint"
}
```

Recommended codes:

- [ ] `SUPPORT_USER_EMAIL_REQUIRED`
  - `requiredAction`: `fix_form`
- [ ] `SUPPORT_USER_INACTIVE`
  - `requiredAction`: `edit_user`
- [ ] `SUPPORT_USER_AUTH_LINK_FAILED`
  - `requiredAction`: `contact_admin`
- [ ] `SUPPORT_USER_INVITE_FAILED`
  - `requiredAction`: `retry`
- [ ] `PASSWORD_RESET_FAILED`
  - `requiredAction`: `retry`
- [ ] `ROLE_NOTICE_FAILED`
  - `requiredAction`: `retry`
- [ ] `OTP_RATE_LIMITED`
  - `requiredAction`: `wait`
- [ ] `OTP_INVALID`
  - `requiredAction`: `retry_code`
- [ ] `OTP_EXPIRED`
  - `requiredAction`: `request_new_code`
- [ ] `OTP_VERIFICATION_FAILED`
  - `requiredAction`: `retry`

## Phase 7: Email Templates

- [ ] Support console invite email.
- [ ] Password reset email.
- [ ] Role/access changed email.
- [ ] OTP login email.

Template requirements:

- Use Workside branding.
- Include clear action button.
- Include expiration time for invite/reset/OTP links.
- Never include raw passwords.
- Include support contact information.

## Phase 8: SMS Templates

- [ ] Invite SMS notice.
- [ ] Role/access changed SMS notice.
- [ ] OTP SMS when enabled by policy.
- [ ] New session assignment SMS, if not already covered by assignment notifications.

SMS requirements:

- Keep messages short.
- Include only safe operational information.
- Do not include sensitive lead/customer details unless explicitly approved.

## Phase 9: Audit

- [ ] `support_user_invite_sent`
- [ ] `support_user_invite_failed`
- [ ] `support_user_password_reset_sent`
- [ ] `support_user_password_reset_failed`
- [ ] `support_user_role_notice_sent`
- [ ] `support_user_role_notice_failed`
- [ ] `support_login_otp_sent`
- [ ] `support_login_otp_verified`
- [ ] `support_login_otp_failed`

Each audit event should include:

- actor id/email/role when admin initiated
- target support user id/email
- product/tenant scope when relevant
- notification channel
- provider message id when available
- timestamp

## Phase 10: Tests

- [ ] Super-admin can send invite.
- [ ] Non-super-admin cannot send invite.
- [ ] Invite creates or links auth account.
- [ ] Invite email is sent through SendGrid.
- [ ] Password reset sends email.
- [ ] Role notice sends email.
- [ ] Role notice optionally sends SMS when phone exists.
- [ ] OTP send succeeds for active support user.
- [ ] OTP send uses generic response for unknown email.
- [ ] OTP verify succeeds with valid code.
- [ ] OTP verify fails with expired code.
- [ ] OTP verify fails after too many attempts.
- [ ] OTP verify returns token accepted by support API.
- [ ] Disabled/inactive support user cannot log in via OTP.

## Definition of Done

- Super-admin can invite support users from the console.
- Support users can set/reset passwords.
- Support users can request and verify OTP login.
- Role/access changes can trigger clean notifications.
- Email/SMS attempts are audited.
- Auth claims and support user access stay synchronized.
- Error responses are stable and frontend-friendly.

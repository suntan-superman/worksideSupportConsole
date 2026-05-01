# Support Console Authorization Contract

Date: 2026-05-01

## Problem

Firebase Authentication confirms that a person owns a valid Merxus/Firebase account, but that is not enough to authorize access to the Workside Support Console.

Any Firebase-authenticated Merxus user must not automatically be allowed into the support console.

## Required Model

Create and maintain a backend-owned support-user authorization record, managed by `super_admin`.

Recommended collection:

```ts
supportUsers
```

Recommended document shape:

```ts
type SupportUser = {
  id: string;
  firebaseUid: string;
  email: string;
  name: string;
  phone?: string;
  role: "super_admin" | "admin" | "support_admin" | "support_agent" | "sales_agent" | "dispatcher" | "viewer";
  active: boolean;
  departments: string[];
  allowedProducts: string[];
  allowedTenantIds: string[]; // may include "__all__" only for trusted admin-style roles
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};
```

## Login Authorization

After Firebase token verification, backend support routes must resolve:

1. Firebase UID
2. Email
3. Matching active `supportUsers` record
4. Role and access scope

If no active support-user record exists, return:

```http
403 Forbidden
```

```json
{
  "error": {
    "code": "SUPPORT_CONSOLE_ACCESS_DENIED",
    "message": "This account is not authorized for the support console.",
    "requiredAction": "add_support_user"
  }
}
```

## Recommended `/support/me`

Add:

```http
GET /support/me
```

Response when authorized:

```json
{
  "user": {
    "id": "support_user_id",
    "firebaseUid": "firebase_uid",
    "email": "agent@example.com",
    "name": "Mike",
    "role": "support_agent",
    "active": true,
    "departments": ["support"],
    "allowedProducts": ["merxus"],
    "allowedTenantIds": ["office_123"]
  }
}
```

Response when authenticated but not authorized:

```http
403 Forbidden
```

with `SUPPORT_CONSOLE_ACCESS_DENIED`.

## Custom Claims

The backend may mirror support authorization into Firebase custom claims for faster UI boot:

```json
{
  "role": "support_agent",
  "supportUserId": "support_user_id",
  "allowedProducts": ["merxus"],
  "allowedTenantIds": ["office_123"]
}
```

Claims are a cache, not the source of truth. The backend must still validate the `supportUsers` record on privileged routes.

## Required Route Enforcement

Every `/support/*` route must reject users without an active support-user record:

- `GET /support/products`
- `GET /support/tenants`
- `GET /support/sessions`
- `GET /support/sessions/:id`
- `POST /support/sessions/:id/request-transfer`
- `POST /support/sessions/:id/takeover`
- `POST /support/sessions/:id/reply`
- `POST /support/sessions/:id/close`
- `PATCH /support/sessions/:id/lead`
- `POST /support/sessions/:id/inquiry`
- `/support/admin/*`

Admin routes must additionally require `super_admin` or the explicitly allowed admin role.

## Frontend Compatibility

The frontend now performs a pre-entry authorization check:

- Allows users with recognized support custom claims.
- Allows users who appear as an active support user from the support-user API.
- Shows a clean login error and signs out otherwise.

This is only UX protection. Backend route enforcement is mandatory.

## Acceptance Tests

- [ ] Existing Firebase user with no support-user record cannot access `/support/me`.
- [ ] Existing Firebase user with no support-user record cannot access `/support/sessions`.
- [ ] Active support user can log in and list only allowed sessions.
- [ ] Inactive support user receives `SUPPORT_CONSOLE_ACCESS_DENIED`.
- [ ] Removed support user loses access after token refresh or next API request.
- [ ] Super admin can create/update/deactivate support users.
- [ ] Admin routes reject support agents.

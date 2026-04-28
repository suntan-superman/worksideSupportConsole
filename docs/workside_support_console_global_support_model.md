# Workside Support Console Frontend — Global Support Model Update
## Codex-Ready Instructions

## Objective

Update the Support Console UI so Workside Software employees can support all customers globally.

The console should not require a tenant ID at login. Users should log in first, then view all accessible sessions with filters for product, tenant/customer, status, urgency, and assignment.

---

## Current Problem

The current login screen asks for:

- Tenant ID
- Product

This makes the console feel tenant-scoped, but the business goal is global support across products and customers.

---

## Correct UX Model

## Login
Login should only authenticate the internal user.

Required:
- Email
- Password

Not required:
- Tenant ID
- Product

---

## After Login
Show the main Support Console dashboard with filters:

```txt
Product: [All Products]
Tenant/Customer: [All Customers]
Status: [All Statuses]
Urgency: [All]
Assigned To: [All]
```

---

## Required Frontend Changes

## 1. Remove tenantId requirement from login

Update login UI:

Remove or hide:
- Tenant ID input
- Product selector

Login should only handle Firebase authentication.

---

## 2. Add global filter state

Create global support filter state:

```ts
type SupportFilters = {
  product?: string;
  tenantId?: string;
  status?: string;
  urgency?: string;
  assignedTo?: string;
};
```

Default:

```ts
{
  product: "",
  tenantId: "",
  status: "",
  urgency: "",
  assignedTo: ""
}
```

Empty string means "All".

---

## 3. Load available products

Call:

```http
GET /support/products
```

Use response to populate product filter.

Fallback static options if endpoint unavailable during dev:

```ts
[
  { id: "merxus", label: "Merxus AI" },
  { id: "home_advisor", label: "Workside Home Advisor" },
  { id: "workside_logistics", label: "Workside Logistics" }
]
```

---

## 4. Load available tenants/customers

Call:

```http
GET /support/tenants
```

Populate Tenant/Customer filter.

If product filter is selected, optionally filter tenants by product on frontend or via:

```http
GET /support/tenants?product=merxus
```

---

## 5. Update session list API calls

Current calls likely always include tenantId/product.

Change to only include filters when selected.

```ts
const params: Record<string, string> = {};

if (filters.product) params.product = filters.product;
if (filters.tenantId) params.tenantId = filters.tenantId;
if (filters.status) params.status = filters.status;
if (filters.urgency) params.urgency = filters.urgency;
if (filters.assignedTo) params.assignedTo = filters.assignedTo;

const response = await api.get("/support/sessions", { params });
```

Do not send blank tenantId.

---

## 6. Update metrics API calls

Same pattern:

```ts
await api.get("/support/metrics", { params });
```

No tenant required unless the user selected one.

---

## 7. Keep action APIs unchanged

For action buttons:

- request transfer
- takeover
- reply
- close
- save lead
- save inquiry

Do not require the user to manually select a tenant.

Use the selected session ID.

Backend will load the session and validate tenant/product.

Example:

```ts
await api.post(`/support/sessions/${sessionId}/reply`, { message });
```

---

## 8. Show tenant/customer in tables

Update sessions table columns:

- Product
- Tenant/Customer
- Lead/Visitor
- Status
- Urgency
- Assigned To
- Last Activity

This is critical now that rows may come from multiple tenants.

---

## 9. Add product badges

Show product labels:

- Merxus AI
- Home Advisor
- Workside Logistics

Use badges so support staff can quickly scan.

---

## 10. Add tenant/customer drilldown

When a session is selected, show:

- tenant name
- tenantId
- product
- organization/customer
- source app

---

## 11. Role behavior

Frontend should not decide security, but should improve UX.

If backend/user claims indicate:

### super_admin/admin
- show all filters
- show all action buttons

### support_agent/sales_agent/dispatcher
- show filters based on returned products/tenants
- hide actions not applicable by role if role info is available

### viewer
- hide action buttons:
  - takeover
  - reply
  - close
  - edit lead
  - save inquiry

---

## 12. Unauthorized/forbidden handling

If backend returns:

- PRODUCT_ACCESS_DENIED
- TENANT_ACCESS_DENIED
- GLOBAL_SCOPE_NOT_ALLOWED

Show a friendly error:

```txt
You do not have access to this product or customer. Contact an administrator if you believe this is incorrect.
```

Do not crash.

---

## 13. Empty state updates

If no sessions returned:

```txt
No conversations match the selected filters.
```

If auth missing:

```txt
Please sign in to access the Support Console.
```

If forbidden:

```txt
You are signed in, but your account does not have access to support sessions.
```

---

## 14. Environment variables

Keep:

```env
VITE_API_BASE_URL=https://api.merxus.ai
VITE_SUPPORT_REALTIME_URL=wss://api.merxus.ai/support/realtime
```

Firebase env vars remain required for login:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

---

## 15. Realtime behavior

Realtime should subscribe globally for the user’s accessible scope.

If product/tenant filters are active, frontend may still receive global events but should only update visible rows matching active filters.

Preferred future backend model:

```txt
/support/realtime?product=merxus&tenantId=abc
```

For now, keep current websocket behavior and refresh list when relevant events arrive.

---

## 16. Manual QA checklist

Test:

1. Login without tenant ID
2. Sessions load across all accessible tenants
3. Product filter works
4. Tenant/customer filter works
5. Status filter works
6. Click session from tenant A
7. Reply/takeover/close works without manually entering tenant ID
8. Forbidden tenant returns friendly error
9. Viewer role is read-only
10. super_admin can see all sessions

---

## Codex Prompt

```txt
Update the Workside Support Console frontend for the global support model.

The console is used by Workside Software employees to support all customers across all products. Do not require Tenant ID or Product on the login screen. Login should only authenticate with Firebase email/password.

After login, show global support views with filters:
- Product
- Tenant/Customer
- Status
- Urgency
- Assigned To

Load products from GET /support/products and tenants from GET /support/tenants. Use fallback static product labels only if needed during development.

Update session list and metrics calls so tenantId/product are optional filters, not required login values. Do not send blank tenantId or blank product. For action endpoints, use only the sessionId; the backend will load the session and enforce tenant/product safety.

Update tables to display product and tenant/customer columns. Add friendly unauthorized/forbidden error states. Keep backend error handling for collect_lead, collect_inquiry, invalid state, auth, and refresh actions.

Do not weaken security in the frontend. Backend remains authoritative.
```

---

## Definition of Done

- login no longer asks for tenantId
- login no longer requires product
- global sessions list loads after authentication
- product filter works
- tenant/customer filter works
- session actions work from global list
- table shows product and tenant/customer context
- forbidden/unauthorized states are friendly
- no blank tenantId/product values are sent

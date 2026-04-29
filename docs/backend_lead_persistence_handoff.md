# Backend Handoff: Lead Persistence / Read-Model Mismatch

Updated: April 28, 2026 (America/Los_Angeles)

## Confirmed Behavior

Frontend is successfully calling:

- `PATCH /support/sessions/:sessionId/lead` -> `200 OK`

Evidence from `output.txt`:

- `PATCH /support/sessions/CA19384f7bc1e978d51e016fe95928246a/lead` returned `200` around Apr 28, 2026 8:47 AM.
- Immediately after, repeated reads continue:
  - `GET /support/sessions/:id`
  - `GET /support/sessions?product=merxus`
- UI still cannot confirm persisted lead identity from backend reads.

## What This Means

This is no longer a frontend transport issue. It is a backend persistence/read-model contract issue:

1. Lead write may not be persisted in canonical session storage, or
2. Lead write is persisted but list/detail serializers do not expose the updated fields, or
3. Write/read models are different and read projection is stale/not refreshed.

## Required Backend Contract (Must Be True)

After `PATCH /support/sessions/:id/lead` succeeds:

1. `GET /support/sessions/:id` must return updated lead identity immediately:
   - `leadName` (or canonical equivalent mapped to this)
   - `leadEmail`
   - optional `leadPhone`, `leadCompany`
   - `leadCaptured: true` when required identity is present
2. `GET /support/sessions` must return the same updated identity for that session row.
3. Field naming must be consistent across write and read endpoints.

## Backend Implementation Checklist

1. Verify the lead PATCH handler writes to the same session record used by list/detail queries.
2. Verify no write is going to a side collection without read projection refresh.
3. Ensure session list query includes projected lead fields (not a reduced projection omitting lead identity).
4. Ensure detail serializer and list serializer map the same lead source fields.
5. Ensure `leadCaptured` is derived from persisted values (name+email per current console rule).
6. Add server log for this flow (temporary):
   - incoming PATCH body
   - session id
   - persisted fields after write
   - list/detail values returned for same session id after write

## Expected Response Shape (Recommended Canonical)

For `PATCH /support/sessions/:id/lead`:

```json
{
  "session": {
    "id": "CA19384f7bc1e978d51e016fe95928246a",
    "leadName": "Stanley Roy",
    "leadEmail": "sroy@prologixsa.com",
    "leadPhone": "(555) 555-5555",
    "leadCompany": "Workside",
    "leadCaptured": true
  },
  "messages": []
}
```

For `GET /support/sessions/:id` and list item in `GET /support/sessions`:

- same lead fields and `leadCaptured` semantics as above.

## Quick Validation Script (Backend Team)

1. Save lead:
   - `PATCH /support/sessions/:id/lead` with name+email.
2. Immediately read detail:
   - `GET /support/sessions/:id`
3. Immediately read list:
   - `GET /support/sessions?product=merxus`
4. Confirm same updated lead fields in both responses.

If step 2 or 3 does not show updated values, backend contract is still broken.

## Current Frontend State

Frontend already:

1. Sends lead save requests (confirmed by backend logs).
2. Retries detail verification after save.
3. Pins saved values locally to prevent immediate UX loss.
4. Maps many lead field aliases for compatibility.

Remaining blocker is backend persistence/read consistency.

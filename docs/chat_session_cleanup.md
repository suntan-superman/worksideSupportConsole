# Chat Session Cleanup

Website chat sessions are stored in Google Cloud Firestore, not MongoDB.

Main paths:

```txt
callSessions/{sessionId}
callSessions/{sessionId}/supportActions/{actionId}
callSessions/{sessionId}/supportAuditLogs/{auditId}
supportAuditLogs/{auditId}
publicDemoRequests/{requestId}
```

The cleanup script is dry-run by default. Always run a dry run first and review the counts before executing.

## Firebase Project

The backend default project is:

```env
FIREBASE_PROJECT_ID=merxus-f0872
```

You can pass it explicitly:

```bash
npm run cleanup:chat-sessions -- --before 2026-05-01 --projectId merxus-f0872
```

## Credentials

Use one of these Firebase Admin credential options:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
```

or:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"project_id":"merxus-f0872",...}
```

or run with Google Application Default Credentials already configured by `gcloud`.

## Dry Run

```bash
npm run cleanup:chat-sessions -- --before 2026-05-01
```

The cutoff is exclusive. For example, `--before 2026-05-01` matches sessions earlier than `2026-05-01T00:00:00.000Z`.

## Execute

Deletion requires both `--execute` and the exact confirmation phrase:

```bash
npm run cleanup:chat-sessions -- --before 2026-05-01 --execute --confirm DELETE_CHAT_SESSIONS_BEFORE_DATE
```

The script deletes:

- matching `callSessions` documents
- each matching session's `supportActions` subcollection
- each matching session's per-session `supportAuditLogs` subcollection
- global `supportAuditLogs` entries that reference the matched session ids

`publicDemoRequests` is skipped unless explicitly requested.

## Optional Scope

```bash
npm run cleanup:chat-sessions -- --before 2026-05-01 --product merxus --tenantId merxus-platform
```

## Include Demo Requests

Use this only when you also want to purge old landing-page demo request records:

```bash
npm run cleanup:chat-sessions -- --before 2026-05-01 --includeDemoRequests
```

## Date Fields

Default session date fields:

```txt
createdAt,startedAt,initialDate,lastActivityAt,updatedAt,support.publicChat.createdAt,support.transfer.requestedAt
```

Override if needed:

```bash
npm run cleanup:chat-sessions -- --before 2026-05-01 --dateFields createdAt,updatedAt
```

## Scan All Fallback

The script queries by date fields. If old sessions are missing those indexed date fields, use:

```bash
npm run cleanup:chat-sessions -- --before 2026-05-01 --scanAll
```

`--scanAll` reads all `callSessions` client-side and filters locally, so use it intentionally.

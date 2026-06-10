#!/usr/bin/env node

import fs from "node:fs";
import admin from "firebase-admin";

const DEFAULT_PROJECT_ID = "merxus-f0872";
const SESSION_COLLECTION = "callSessions";
const SESSION_SUBCOLLECTIONS = ["supportActions", "supportAuditLogs"];
const GLOBAL_AUDIT_COLLECTION = "supportAuditLogs";
const DEMO_REQUEST_COLLECTION = "publicDemoRequests";
const DEFAULT_DATE_FIELDS = [
  "createdAt",
  "startedAt",
  "initialDate",
  "lastActivityAt",
  "updatedAt",
  "support.publicChat.createdAt",
  "support.transfer.requestedAt",
];
const DEFAULT_REFERENCE_FIELDS = [
  "sessionId",
  "callSessionId",
  "supportSessionId",
  "publicSessionId",
  "conversationId",
];
const CONFIRMATION = "DELETE_CHAT_SESSIONS_BEFORE_DATE";
const DELETE_BATCH_SIZE = 450;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;

    const [rawKey, inlineValue] = item.slice(2).split("=", 2);
    const key = rawKey.trim();
    if (!key) continue;

    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
}

function listArg(value, fallback) {
  if (!value) return fallback;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function boolArg(value) {
  return value === true || value === "true" || value === "1" || value === "yes";
}

function showHelp() {
  console.log(`
Purge Firestore website chat sessions and associated data before a cutoff date.

Dry run:
  npm run cleanup:chat-sessions -- --before 2026-05-01

Execute:
  npm run cleanup:chat-sessions -- --before 2026-05-01 --execute --confirm ${CONFIRMATION}

Required:
  --before YYYY-MM-DD or ISO timestamp
  Firebase Admin credentials through one of:
    - GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
    - FIREBASE_SERVICE_ACCOUNT_JSON='{"project_id":"..."}'
    - Application Default Credentials already configured with gcloud

Optional:
  --projectId merxus-f0872
  --product merxus
  --tenantId merxus-platform
  --dateFields createdAt,startedAt,updatedAt
  --referenceFields sessionId,callSessionId,supportSessionId,publicSessionId,conversationId
  --includeDemoRequests includes publicDemoRequests cleanup
  --scanAll scans callSessions client-side when date field queries are incomplete
  --allowRecent allows a cutoff less than 24 hours ago

Notes:
  - The script is dry-run by default.
  - It deletes callSessions/{sessionId}, supportActions, per-session supportAuditLogs,
    and global supportAuditLogs that reference deleted session ids.
  - publicDemoRequests is only included when --includeDemoRequests is provided.
`);
}

function parseCutoff(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readNested(value, path) {
  return String(path)
    .split(".")
    .reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), value);
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
  }
  return null;
}

function getFirstSessionDateMillis(data, dateFields) {
  for (const field of dateFields) {
    const millis = toMillis(readNested(data, field));
    if (millis !== null) return millis;
  }
  return null;
}

function matchesScope(data, { product, tenantId }) {
  if (product) {
    const values = [
      data.product,
      data.productId,
      readNested(data, "support.product"),
      readNested(data, "support.publicChat.product"),
    ].map((item) => String(item || "").trim());
    if (!values.includes(product)) return false;
  }

  if (tenantId) {
    const values = [
      data.tenantId,
      data.customerId,
      readNested(data, "tenant.id"),
      readNested(data, "support.tenantId"),
      readNested(data, "support.publicChat.tenantId"),
      readNested(data, "support.lead.tenantId"),
    ].map((item) => String(item || "").trim());
    if (!values.includes(tenantId)) return false;
  }

  return true;
}

function addSessionId(ids, value) {
  const text = String(value || "").trim();
  if (text) ids.add(text);
}

function initializeFirebase({ projectId }) {
  if (admin.apps.length) return;

  const serviceAccountJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (serviceAccountJson) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
      projectId,
    });
    return;
  }

  const serviceAccountPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId,
    });
    return;
  }

  admin.initializeApp({ projectId });
}

async function querySessionsByDateFields(db, { cutoff, dateFields, scope }) {
  const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoff);
  const byPath = new Map();

  for (const field of dateFields) {
    for (const comparisonValue of [cutoffTimestamp, cutoff.toISOString()]) {
      try {
        const snapshot = await db.collection(SESSION_COLLECTION).where(field, "<", comparisonValue).get();
        for (const doc of snapshot.docs) {
          const data = doc.data();
          if (getFirstSessionDateMillis(data, dateFields) >= cutoff.getTime()) continue;
          if (!matchesScope(data, scope)) continue;
          byPath.set(doc.ref.path, doc);
        }
      } catch (error) {
        console.warn(`Skipped date query ${SESSION_COLLECTION}.${field}: ${error.message}`);
      }
    }
  }

  return [...byPath.values()];
}

async function scanAllSessions(db, { cutoff, dateFields, scope }) {
  const snapshot = await db.collection(SESSION_COLLECTION).get();
  return snapshot.docs.filter((doc) => {
    const data = doc.data();
    const millis = getFirstSessionDateMillis(data, dateFields);
    return millis !== null && millis < cutoff.getTime() && matchesScope(data, scope);
  });
}

async function countSubcollectionDocs(sessionDoc, subcollectionName) {
  const snapshot = await sessionDoc.ref.collection(subcollectionName).get();
  return snapshot.size;
}

async function findGlobalAuditDocs(db, sessionIds, referenceFields) {
  const byPath = new Map();

  for (const sessionId of sessionIds) {
    for (const field of referenceFields) {
      try {
        const snapshot = await db.collection(GLOBAL_AUDIT_COLLECTION).where(field, "==", sessionId).get();
        for (const doc of snapshot.docs) byPath.set(doc.ref.path, doc);
      } catch (error) {
        console.warn(`Skipped audit query ${GLOBAL_AUDIT_COLLECTION}.${field}: ${error.message}`);
      }
    }
  }

  return [...byPath.values()];
}

async function findDemoRequestDocs(db, { cutoff, dateFields, scope }) {
  const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoff);
  const byPath = new Map();

  for (const field of dateFields) {
    for (const comparisonValue of [cutoffTimestamp, cutoff.toISOString()]) {
      try {
        const snapshot = await db.collection(DEMO_REQUEST_COLLECTION).where(field, "<", comparisonValue).get();
        for (const doc of snapshot.docs) {
          const data = doc.data();
          if (getFirstSessionDateMillis(data, dateFields) >= cutoff.getTime()) continue;
          if (!matchesScope(data, scope)) continue;
          byPath.set(doc.ref.path, doc);
        }
      } catch (error) {
        console.warn(`Skipped demo request query ${DEMO_REQUEST_COLLECTION}.${field}: ${error.message}`);
      }
    }
  }

  return [...byPath.values()];
}

async function deleteDocsInBatches(db, docs) {
  let deleted = 0;
  for (let index = 0; index < docs.length; index += DELETE_BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(index, index + DELETE_BATCH_SIZE);
    for (const doc of chunk) batch.delete(doc.ref);
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

async function deleteSubcollection(db, sessionDoc, subcollectionName) {
  const snapshot = await sessionDoc.ref.collection(subcollectionName).get();
  return deleteDocsInBatches(db, snapshot.docs);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    showHelp();
    return;
  }

  const cutoff = parseCutoff(args.before || process.env.CHAT_PURGE_BEFORE);
  if (!cutoff) {
    console.error("Missing or invalid --before date.");
    showHelp();
    process.exitCode = 1;
    return;
  }

  const execute = boolArg(args.execute);
  const confirm = String(args.confirm || "").trim();
  if (execute && confirm !== CONFIRMATION) {
    console.error(`Refusing to delete. Add --confirm ${CONFIRMATION} to execute.`);
    process.exitCode = 1;
    return;
  }

  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  if (execute && cutoff.getTime() > oneDayAgo && !boolArg(args.allowRecent)) {
    console.error("Refusing to delete with a cutoff less than 24 hours ago. Add --allowRecent if intentional.");
    process.exitCode = 1;
    return;
  }

  const projectId = String(args.projectId || process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID).trim();
  const dateFields = listArg(args.dateFields, DEFAULT_DATE_FIELDS);
  const referenceFields = listArg(args.referenceFields, DEFAULT_REFERENCE_FIELDS);
  const scope = {
    product: String(args.product || "").trim(),
    tenantId: String(args.tenantId || "").trim(),
  };

  initializeFirebase({ projectId });
  const db = admin.firestore();

  console.log(`Mode: ${execute ? "EXECUTE" : "DRY RUN"}`);
  console.log(`Firebase project: ${projectId}`);
  console.log(`Cutoff: ${cutoff.toISOString()} (exclusive)`);
  if (scope.product) console.log(`Product scope: ${scope.product}`);
  if (scope.tenantId) console.log(`Tenant scope: ${scope.tenantId}`);
  console.log("");

  let sessionDocs = await querySessionsByDateFields(db, { cutoff, dateFields, scope });
  if (boolArg(args.scanAll)) {
    const scannedDocs = await scanAllSessions(db, { cutoff, dateFields, scope });
    const byPath = new Map(sessionDocs.map((doc) => [doc.ref.path, doc]));
    for (const doc of scannedDocs) byPath.set(doc.ref.path, doc);
    sessionDocs = [...byPath.values()];
  }

  const sessionIds = new Set();
  for (const doc of sessionDocs) {
    const data = doc.data();
    addSessionId(sessionIds, doc.id);
    addSessionId(sessionIds, data.id);
    addSessionId(sessionIds, data.sessionId);
    addSessionId(sessionIds, data.callSessionId);
    addSessionId(sessionIds, data.publicSessionId);
    addSessionId(sessionIds, data.supportSessionId);
  }

  const subcollectionCounts = {};
  for (const name of SESSION_SUBCOLLECTIONS) subcollectionCounts[name] = 0;
  for (const doc of sessionDocs) {
    for (const subcollection of SESSION_SUBCOLLECTIONS) {
      subcollectionCounts[subcollection] += await countSubcollectionDocs(doc, subcollection);
    }
  }

  const globalAuditDocs = await findGlobalAuditDocs(db, sessionIds, referenceFields);
  const demoRequestDocs = boolArg(args.includeDemoRequests)
    ? await findDemoRequestDocs(db, { cutoff, dateFields, scope })
    : [];

  console.log("Matched Firestore documents:");
  console.log(`  ${SESSION_COLLECTION}: ${sessionDocs.length}`);
  for (const [name, count] of Object.entries(subcollectionCounts)) {
    console.log(`  ${SESSION_COLLECTION}/{sessionId}/${name}: ${count}`);
  }
  console.log(`  ${GLOBAL_AUDIT_COLLECTION}: ${globalAuditDocs.length}`);
  console.log(`  ${DEMO_REQUEST_COLLECTION}: ${boolArg(args.includeDemoRequests) ? demoRequestDocs.length : "skipped"}`);
  console.log("");

  if (!execute) {
    console.log("Dry run only. Re-run with --execute and the confirmation flag to delete.");
    return;
  }

  for (const doc of sessionDocs) {
    for (const subcollection of SESSION_SUBCOLLECTIONS) {
      const deleted = await deleteSubcollection(db, doc, subcollection);
      if (deleted) console.log(`Deleted ${deleted} from ${doc.ref.path}/${subcollection}`);
    }
  }

  const deletedGlobalAudit = await deleteDocsInBatches(db, globalAuditDocs);
  if (deletedGlobalAudit) console.log(`Deleted ${deletedGlobalAudit} from ${GLOBAL_AUDIT_COLLECTION}`);

  const deletedDemoRequests = await deleteDocsInBatches(db, demoRequestDocs);
  if (deletedDemoRequests) console.log(`Deleted ${deletedDemoRequests} from ${DEMO_REQUEST_COLLECTION}`);

  const deletedSessions = await deleteDocsInBatches(db, sessionDocs);
  console.log(`Deleted ${deletedSessions} from ${SESSION_COLLECTION}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

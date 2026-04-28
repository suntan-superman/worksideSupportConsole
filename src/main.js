import "./style.css";
import {
  closeSupportSession,
  escalateSupportSession,
  getChatEndpointTrace,
  getSupportSession,
  isHumanSession,
  isSessionEscalated,
  listSupportProducts,
  listSupportSessions,
  listSupportTenants,
  saveInquiryForSession,
  saveLeadForSession,
  sendAgentReply,
  takeOverSession,
} from "./services/chat";
import { isAuthErrorCode, parseChatApiError, shouldRefreshSession } from "./services/chatErrors";
import {
  getStoredToken,
  hasFirebaseAuthConfig,
  initializeAuthBridge,
  setStoredToken,
  signInWithFirebaseCredentials,
  signOutAllAuth,
} from "./services/auth";

const AGENT_STORAGE_KEY = "workside_support_agent";
const SELECTED_SESSION_KEY = "workside_selected_session";
const FILTERS_STORAGE_KEY = "workside_support_filters";

const URGENCY_OPTIONS = ["low", "medium", "high"];
const SESSION_STATUS_OPTIONS = [
  "escalated",
  "active_human",
  "active_ai",
  "after_hours_intake",
  "closed",
];
const INTENT_OPTIONS = ["sales", "support", "booking", "general"];
const ESCALATION_REASONS = [
  "user_requested_human",
  "low_ai_confidence",
  "sales_opportunity",
  "support_issue",
  "billing_issue",
  "urgent_keyword",
  "manual",
];
const FALLBACK_PRODUCTS = [
  { id: "merxus", label: "Merxus AI" },
  { id: "home_advisor", label: "Workside Home Advisor" },
  { id: "workside_logistics", label: "Workside Logistics" },
];
const ACCESS_DENIED_CODES = new Set([
  "PRODUCT_ACCESS_DENIED",
  "TENANT_ACCESS_DENIED",
  "GLOBAL_SCOPE_NOT_ALLOWED",
]);
const POLLING_INTERVAL_MS = 5000;

function normalizeFilterState(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    product: String(value.product ?? "").trim(),
    tenantId: String(value.tenantId ?? "").trim(),
    status: String(value.status ?? "").trim(),
    urgency: String(value.urgency ?? "").trim(),
    assignedTo: String(value.assignedTo ?? "").trim(),
  };
}

function readStoredFilters() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY) ?? "{}");
    return normalizeFilterState(parsed);
  } catch {
    return normalizeFilterState({});
  }
}

function persistFilters() {
  localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(state.supportFilters));
}

function productLabelFromKey(value) {
  const key = String(value ?? "").trim().toLowerCase();
  if (key === "merxus") return "Merxus AI";
  if (key === "home_advisor") return "Home Advisor";
  if (key === "workside_logistics") return "Workside Logistics";
  if (!key) return "Unknown Product";
  return key.replace(/_/g, " ");
}

function abbreviateMiddle(value, { max = 24, keep = 8 } = {}) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  const suffixSize = Math.max(4, Math.min(keep, Math.floor(max / 2)));
  const prefixSize = Math.max(4, max - suffixSize - 3);
  return `${text.slice(0, prefixSize)}...${text.slice(-suffixSize)}`;
}

function isViewerRole() {
  return String(state.userRole ?? "").toLowerCase() === "viewer";
}

async function refreshUserRole() {
  const authRef = window?.firebaseAuth;
  const currentUser = authRef?.currentUser;
  if (!currentUser || typeof currentUser.getIdTokenResult !== "function") {
    state.userRole = "";
    return;
  }
  try {
    const tokenResult = await currentUser.getIdTokenResult();
    const claims = tokenResult?.claims ?? {};
    const claimRole = claims.role ?? claims.supportRole ?? claims.userRole ?? "";
    state.userRole = String(claimRole ?? "").trim();
  } catch {
    state.userRole = "";
  }
}

const app = document.querySelector("#app");

const storedFilters = readStoredFilters();

const state = {
  supportFilters: storedFilters,
  productOptions: [],
  tenantOptions: [],
  agentName: localStorage.getItem(AGENT_STORAGE_KEY) ?? "",
  selectedSessionId: localStorage.getItem(SELECTED_SESSION_KEY) ?? "",
  sessions: [],
  selectedSession: null,
  messages: [],
  loadingSessions: false,
  loadingSession: false,
  busyAction: false,
  filter: "all",
  search: "",
  replyDraft: "",
  leadDraft: {
    name: "",
    email: "",
    phone: "",
    company: "",
  },
  inquiryDraft: {
    messageSummary: "",
    urgency: "medium",
    intent: "general",
  },
  transferDraft: {
    reason: "manual",
    note: "",
  },
  leadDirty: false,
  inquiryDirty: false,
  transferDirty: false,
  banner: null,
  lastUpdatedAt: null,
  realtimeStatus: "offline",
  lastTransferQueueCount: 0,
  showDiagnostics: false,
  authBlocked: false,
  authMessage: "",
  accessDenied: false,
  isAuthenticated: false,
  authError: "",
  authTokenDraft: getStoredToken(),
  authEmail: "",
  authPassword: "",
  authPasswordVisible: false,
  userRole: "",
};

let bannerTimer = null;
let pollingInterval = null;
let pollingInFlight = false;

function isUserEditingDetailForm() {
  const active = document.activeElement;
  if (!active) return false;
  const tagName = String(active.tagName ?? "").toUpperCase();
  if (tagName !== "INPUT" && tagName !== "TEXTAREA" && tagName !== "SELECT") {
    return false;
  }

  const editableIds = new Set([
    "lead-name-input",
    "lead-email-input",
    "lead-phone-input",
    "lead-company-input",
    "inquiry-summary-input",
    "inquiry-urgency-input",
    "inquiry-intent-input",
    "reply-input",
    "transfer-reason-input",
    "transfer-note-input",
  ]);

  return editableIds.has(active.id);
}

function stopRealtimeAndPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  state.realtimeStatus = "offline";
}

async function runPollingCycle() {
  if (!state.isAuthenticated || pollingInFlight) return;
  if (isUserEditingDetailForm()) return;
  pollingInFlight = true;
  try {
    await loadSessions({ silent: true });
    if (state.selectedSessionId) {
      await loadSelectedSession({ silent: true });
    }
  } finally {
    pollingInFlight = false;
  }
}

function startRealtimeAndPolling() {
  stopRealtimeAndPolling();
  state.realtimeStatus = "live";
  render();
  pollingInterval = setInterval(() => {
    runPollingCycle();
  }, POLLING_INTERVAL_MS);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTimestamp(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(status) {
  switch (status) {
    case "active_ai":
      return "AI";
    case "active_human":
      return "Human";
    case "escalated":
      return "Needs Human";
    case "after_hours_intake":
      return "After Hours";
    case "closed":
      return "Closed";
    default:
      return "Unknown";
  }
}

function statusClass(status) {
  switch (status) {
    case "active_ai":
      return "badge badge-ai";
    case "active_human":
      return "badge badge-human";
    case "escalated":
      return "badge badge-escalated";
    case "after_hours_intake":
      return "badge badge-after-hours";
    case "closed":
      return "badge badge-closed";
    default:
      return "badge";
  }
}

function realtimeStatusClass(status) {
  switch (status) {
    case "live":
      return "status-dot status-live";
    default:
      return "status-dot status-offline";
  }
}

function realtimeStatusLabel(status) {
  switch (status) {
    case "live":
      return "Live updates every 5 seconds";
    default:
      return "Polling paused";
  }
}

const TRACE_LABELS = {
  list_support_sessions: "List Sessions",
  get_support_session: "Get Session Detail",
  takeover_session: "Accept Transfer",
  send_agent_reply: "Send Agent Reply",
  close_support_session: "Close Session",
  escalate_support_session: "Request Transfer",
  save_lead_for_session: "Save Lead",
  save_inquiry_for_session: "Save Inquiry",
  list_support_products: "List Products",
  list_support_tenants: "List Tenants",
};

function setBanner(type, text) {
  state.banner = { type, text };
  render();
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    state.banner = null;
    render();
  }, 5000);
}

function focusElement(selector) {
  setTimeout(() => {
    const target = document.querySelector(selector);
    if (!target) return;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    if (typeof target.focus === "function") {
      target.focus();
    }
  }, 0);
}

function clearAuthBlockedState() {
  if (!state.authBlocked && !state.authMessage) return;
  state.authBlocked = false;
  state.authMessage = "";
}

async function completeAuthenticatedStartup() {
  state.isAuthenticated = true;
  clearAuthBlockedState();
  state.accessDenied = false;
  state.authError = "";
  await refreshUserRole();
  await loadFilterOptions({ silent: true });
  render();

  await loadSessions();
  if (state.selectedSessionId) {
    await loadSelectedSession();
  }

  startRealtimeAndPolling();
}

async function handleFirebaseLogin() {
  const email = String(state.authEmail ?? "").trim();
  const password = String(state.authPassword ?? "");

  if (!email || !password) {
    state.authError = "Email and password are required.";
    render();
    return;
  }

  try {
    state.authError = "";
    render();
    await signInWithFirebaseCredentials(email, password);
    state.authTokenDraft = getStoredToken();
    await completeAuthenticatedStartup();
  } catch (error) {
    state.authError = error?.message ?? "Unable to sign in with Firebase credentials.";
    render();
  }
}

async function handleLogout() {
  await signOutAllAuth();
  stopRealtimeAndPolling();

  state.isAuthenticated = false;
  state.authBlocked = false;
  state.authMessage = "";
  state.authError = "";
  state.authTokenDraft = "";
  state.authEmail = "";
  state.authPassword = "";
  state.authPasswordVisible = false;
  state.sessions = [];
  state.selectedSession = null;
  state.messages = [];
  state.accessDenied = false;
  state.userRole = "";
  state.tenantOptions = [];
  state.productOptions = [];
  state.selectedSessionId = "";
  localStorage.removeItem(SELECTED_SESSION_KEY);

  render();
}

function renderAuthScreen() {
  const firebaseAvailable = hasFirebaseAuthConfig();

  app.innerHTML = `
    <div class="auth-shell">
      <section class="auth-card">
        <div class="auth-brand">
          <h1>Workside Software</h1>
          <h2>Support Console Access</h2>
        </div>
        <p class="auth-subtitle">Sign in with your Workside account to access support sessions.</p>
        ${
          state.authMessage
            ? `<div class="banner banner-warning">Auth issue: ${escapeHtml(state.authMessage)}</div>`
            : ""
        }
        ${
          state.authError
            ? `<div class="banner banner-error">${escapeHtml(state.authError)}</div>`
            : ""
        }

        ${
          firebaseAvailable
            ? `
              <form id="firebase-login-form" class="auth-login-form">
                <label>
                  Email
                  <input id="auth-email-input" type="email" value="${escapeHtml(state.authEmail)}" placeholder="you@workside.ai" />
                </label>
                <label>
                  Password
                  <div class="password-input-wrap">
                    <input id="auth-password-input" type="${state.authPasswordVisible ? "text" : "password"}" value="${escapeHtml(state.authPassword)}" placeholder="Password" />
                    <button
                      id="password-visibility-toggle"
                      class="password-visibility-toggle"
                      type="button"
                      aria-label="${state.authPasswordVisible ? "Hide password" : "Show password"}"
                      aria-pressed="${state.authPasswordVisible ? "true" : "false"}"
                      title="${state.authPasswordVisible ? "Hide password" : "Show password"}"
                    >
                      ${
                        state.authPasswordVisible
                          ? `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
                          : `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle><path d="M4 4l16 16"></path></svg>`
                      }
                    </button>
                  </div>
                </label>
                <button id="firebase-login-button" class="button button-primary" type="submit">Sign In</button>
              </form>
            `
            : `<div class="banner banner-warning">Firebase auth environment variables are missing. Add the required VITE_FIREBASE_* values to sign in.</div>`
        }
      </section>
    </div>
  `;

  bindAuthEvents();
}

function bindAuthEvents() {
  const emailInput = document.querySelector("#auth-email-input");
  if (emailInput) {
    emailInput.addEventListener("input", (event) => {
      state.authEmail = event.target.value;
    });
  }

  const passwordInput = document.querySelector("#auth-password-input");
  if (passwordInput) {
    passwordInput.addEventListener("input", (event) => {
      state.authPassword = event.target.value;
    });
  }

  const passwordToggleButton = document.querySelector("#password-visibility-toggle");
  if (passwordToggleButton) {
    passwordToggleButton.addEventListener("click", () => {
      state.authPasswordVisible = !state.authPasswordVisible;
      render();
      const nextPasswordInput = document.querySelector("#auth-password-input");
      if (nextPasswordInput) {
        nextPasswordInput.focus();
        const length = nextPasswordInput.value.length;
        nextPasswordInput.setSelectionRange(length, length);
      }
    });
  }

  const firebaseLoginForm = document.querySelector("#firebase-login-form");
  if (firebaseLoginForm) {
    firebaseLoginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleFirebaseLogin();
    });
  }
}

async function handleChatApiError(contextLabel, error) {
  const parsed = parseChatApiError(error);
  const message = parsed.code ? `[${parsed.code}] ${parsed.message}` : parsed.message;

  if (isAuthErrorCode(parsed.code) || parsed.requiredAction === "login") {
    state.authBlocked = true;
    state.authMessage = parsed.message;
    state.isAuthenticated = false;
    state.authTokenDraft = "";
    stopRealtimeAndPolling();
    setStoredToken("");
    state.showDiagnostics = true;
    render();
    return;
  }

  if (ACCESS_DENIED_CODES.has(parsed.code) || parsed.requiredAction === "forbidden") {
    state.accessDenied = true;
    if (contextLabel === "Load sessions") {
      state.sessions = [];
      state.selectedSession = null;
      state.messages = [];
      state.selectedSessionId = "";
      localStorage.removeItem(SELECTED_SESSION_KEY);
    }
    setBanner(
      "warning",
      "You do not have access to this product or customer. Contact an administrator if you believe this is incorrect.",
    );
    return;
  }

  if (parsed.requiredAction === "collect_lead" || parsed.code === "LEAD_CAPTURE_REQUIRED") {
    state.showDiagnostics = true;
    const firstMissing = parsed.missingFields?.[0];
    if (firstMissing === "email") {
      focusElement("#lead-email-input");
    } else if (firstMissing === "phone") {
      focusElement("#lead-phone-input");
    } else {
      focusElement("#lead-name-input");
    }
    setBanner("error", message);
    return;
  }

  if (parsed.requiredAction === "collect_name") {
    focusElement("#lead-name-input");
    setBanner("error", message);
    return;
  }

  if (parsed.requiredAction === "collect_email") {
    focusElement("#lead-email-input");
    setBanner("error", message);
    return;
  }

  if (parsed.requiredAction === "collect_phone") {
    focusElement("#lead-phone-input");
    setBanner("error", message);
    return;
  }

  if (parsed.requiredAction === "collect_inquiry" || parsed.code === "INQUIRY_CAPTURE_REQUIRED") {
    state.showDiagnostics = true;
    focusElement("#inquiry-summary-input");
    setBanner("error", message);
    return;
  }

  if (shouldRefreshSession(parsed.requiredAction, parsed.code)) {
    await loadSelectedSession({ silent: true });
    setBanner("error", message || `${contextLabel} failed. Session was refreshed.`);
    return;
  }

  setBanner("error", `${contextLabel} failed: ${message}`);
}

function extractEmail(text) {
  if (!text) return "";
  const regex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const match = String(text).match(regex);
  return match?.[0] ?? "";
}

function extractPhone(text) {
  if (!text) return "";
  const regex = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/;
  const match = String(text).match(regex);
  return match?.[0] ?? "";
}

function extractLikelyName(text) {
  if (!text) return "";
  const source = String(text);
  const patterns = [
    /\bmy name is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /\bi am\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /\bthis is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  const titleCasePair = source.match(/\b([A-Z][a-z]{1,20}\s+[A-Z][a-z]{1,20})\b/);
  return titleCasePair?.[1]?.trim() ?? "";
}

function inferLeadFromMessages(messages) {
  const visitorMessages = (messages ?? []).filter((message) => message.sender === "visitor");
  if (visitorMessages.length === 0) {
    return { name: "", email: "", phone: "" };
  }

  const joined = visitorMessages.map((message) => message.body).join(" ");
  const latest = [...visitorMessages].reverse().map((message) => message.body);

  let email = extractEmail(joined);
  let phone = extractPhone(joined);
  let name = "";

  for (const text of latest) {
    if (!name) name = extractLikelyName(text);
    if (!email) email = extractEmail(text);
    if (!phone) phone = extractPhone(text);
    if (name && email && phone) break;
  }

  return {
    name,
    email,
    phone,
  };
}

function summarizeConversation(messages) {
  const visitorMessages = (messages ?? [])
    .filter((message) => message.sender === "visitor")
    .map((message) => String(message.body ?? "").trim())
    .filter(Boolean);

  if (visitorMessages.length === 0) {
    return "";
  }

  const recent = visitorMessages.slice(-3);
  const summary = recent.join(" | ");
  return summary.length > 360 ? `${summary.slice(0, 357)}...` : summary;
}

function filterSessions(sessions, filter, search) {
  const normalizedSearch = search.trim().toLowerCase();
  return sessions.filter((session) => {
    const filterMatch =
      filter === "all" ||
      (filter === "transfer_queue" && isSessionEscalated(session) && session.status !== "closed") ||
      (filter === "active_human" && isHumanSession(session)) ||
      (filter === "active_ai" && session.status === "active_ai") ||
      (filter === "after_hours_intake" && session.status === "after_hours_intake") ||
      (filter === "closed" && session.status === "closed");

    if (!filterMatch) return false;
    if (!normalizedSearch) return true;

    const haystack = [
      session.id,
      session.leadName,
      session.leadEmail,
      session.lastMessagePreview,
      session.productKey,
      session.tenantId,
      session.tenantName,
      session.organizationName,
      session.assignedToUserId,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });
}

function sortSessionsByPriority(sessions) {
  const list = [...(sessions ?? [])];
  const score = (session) => {
    if (session.status === "closed") return 4;
    if (isSessionEscalated(session)) return 1;
    if (isHumanSession(session)) return 2;
    if (session.status === "after_hours_intake") return 3;
    return 3.5;
  };

  list.sort((a, b) => {
    const scoreDelta = score(a) - score(b);
    if (scoreDelta !== 0) return scoreDelta;
    return Date.parse(b.updatedAt ?? 0) - Date.parse(a.updatedAt ?? 0);
  });

  return list;
}

function canCloseSession(session) {
  if (!session) return { ok: false, reason: "No session selected." };
  if (!session.leadCaptured) {
    return {
      ok: false,
      reason: "Lead capture is required before closing this session.",
    };
  }
  if (session.requiresInquiryCapture && !session.inquiryCaptured) {
    return {
      ok: false,
      reason: "Inquiry intake is required before closing after-hours sessions.",
    };
  }
  return { ok: true };
}

function upsertSession(nextSession) {
  if (!nextSession?.id) return;
  const index = state.sessions.findIndex((item) => item.id === nextSession.id);
  if (index === -1) {
    state.sessions.unshift(nextSession);
  } else {
    state.sessions[index] = {
      ...state.sessions[index],
      ...nextSession,
    };
  }
  state.sessions = sortSessionsByPriority(state.sessions);
}

function updateDraftsFromSession(session, { force = false } = {}) {
  if (!session) return;

  if (force || !state.leadDirty) {
    state.leadDraft = {
      name: session.leadName ?? "",
      email: session.leadEmail ?? "",
      phone: session.leadPhone ?? "",
      company: session.leadCompany ?? "",
    };
  }

  if (force || !state.inquiryDirty) {
    state.inquiryDraft = {
      messageSummary: session.inquirySummary ?? "",
      urgency: session.inquiryUrgency ?? "medium",
      intent: session.inquiryIntent ?? "general",
    };
  }

  if (force || !state.transferDirty) {
    state.transferDraft = {
      reason: session.escalationReason || "manual",
      note: "",
    };
  }
}

function applySessionDetail(detail, { forceDraftSync = false } = {}) {
  state.selectedSession = detail.session;
  state.messages = detail.messages;
  upsertSession(detail.session);
  updateDraftsFromSession(detail.session, { force: forceDraftSync });

  if (!state.leadDirty) {
    const inferred = inferLeadFromMessages(detail.messages);
    if (!state.leadDraft.name && inferred.name) {
      state.leadDraft.name = inferred.name;
    }
    if (!state.leadDraft.email && inferred.email) {
      state.leadDraft.email = inferred.email;
    }
    if (!state.leadDraft.phone && inferred.phone) {
      state.leadDraft.phone = inferred.phone;
    }
  }

  if (!state.inquiryDirty && !state.inquiryDraft.messageSummary) {
    const summary = summarizeConversation(detail.messages);
    if (summary) {
      state.inquiryDraft.messageSummary = summary;
    }
  }
}

function mergeProductOptions(products) {
  const map = new Map();
  for (const fallback of FALLBACK_PRODUCTS) {
    map.set(fallback.id, fallback);
  }
  for (const product of products ?? []) {
    const id = String(product?.id ?? "").trim();
    if (!id) continue;
    const label = String(product?.label ?? "").trim() || productLabelFromKey(id);
    map.set(id, { id, label });
  }
  return [...map.values()];
}

function filterTenantsByProduct(tenants, productKey) {
  if (!productKey) return tenants;
  return (tenants ?? []).filter((tenant) => {
    if (!tenant?.product) return true;
    return String(tenant.product).trim().toLowerCase() === String(productKey).trim().toLowerCase();
  });
}

async function loadFilterOptions({ silent = false } = {}) {
  if (!state.isAuthenticated) return;
  let products = [];
  let tenants = [];

  try {
    products = await listSupportProducts();
  } catch (error) {
    if (!silent) {
      setBanner("warning", "Unable to load products from API. Using fallback product list.");
    }
  }

  state.productOptions = mergeProductOptions(products);

  if (
    state.supportFilters.product &&
    !state.productOptions.some((product) => product.id === state.supportFilters.product)
  ) {
    state.supportFilters.product = "";
    state.supportFilters.tenantId = "";
  }

  try {
    tenants = await listSupportTenants({
      product: state.supportFilters.product || undefined,
    });
  } catch (error) {
    if (!silent) {
      setBanner("warning", "Unable to load tenant/customer filters right now.");
    }
  }

  state.tenantOptions = filterTenantsByProduct(tenants, state.supportFilters.product);
  if (
    state.supportFilters.tenantId &&
    !state.tenantOptions.some((tenant) => tenant.id === state.supportFilters.tenantId)
  ) {
    state.supportFilters.tenantId = "";
  }

  persistFilters();
}

async function loadSessions({ silent = false } = {}) {
  if (!state.isAuthenticated) return;
  if (state.loadingSessions) return;
  state.loadingSessions = true;
  if (!silent) render();

  try {
    const filters = state.supportFilters;
    const sessions = await listSupportSessions({
      product: filters.product || undefined,
      tenantId: filters.tenantId || undefined,
      status: filters.status || undefined,
      urgency: filters.urgency || undefined,
      assignedTo: filters.assignedTo || undefined,
      search: state.search || undefined,
    });

    clearAuthBlockedState();
    state.accessDenied = false;
    state.sessions = sortSessionsByPriority(sessions);
    state.lastUpdatedAt = new Date().toISOString();

    const queueCount = state.sessions.filter(
      (session) => isSessionEscalated(session) && session.status !== "closed",
    ).length;

    if (silent && queueCount > state.lastTransferQueueCount) {
      const delta = queueCount - state.lastTransferQueueCount;
      setBanner(
        "success",
        `${delta} new transfer ${delta === 1 ? "request" : "requests"} entered the queue.`,
      );
    }
    state.lastTransferQueueCount = queueCount;

    if (state.selectedSessionId && !state.sessions.some((session) => session.id === state.selectedSessionId)) {
      state.selectedSessionId = "";
      localStorage.removeItem(SELECTED_SESSION_KEY);
      state.selectedSession = null;
      state.messages = [];
    }

    if (!state.selectedSessionId) {
      const preferred =
        state.sessions.find((session) => isSessionEscalated(session) && session.status !== "closed") ??
        state.sessions[0];
      if (preferred?.id) {
        state.selectedSessionId = preferred.id;
        localStorage.setItem(SELECTED_SESSION_KEY, preferred.id);
      }
    }
  } catch (error) {
    if (!silent) {
      await handleChatApiError("Load sessions", error);
    }
  } finally {
    state.loadingSessions = false;
    if (!silent || !isUserEditingDetailForm()) {
      render();
    }
  }
}

async function loadSelectedSession({ silent = false } = {}) {
  if (!state.isAuthenticated) return;
  if (!state.selectedSessionId || state.loadingSession) return;
  state.loadingSession = true;
  if (!silent) render();

  try {
    const detail = await getSupportSession(state.selectedSessionId);
    clearAuthBlockedState();
    state.accessDenied = false;
    applySessionDetail(detail);
  } catch (error) {
    if (!silent) {
      await handleChatApiError("Load session", error);
    }
  } finally {
    state.loadingSession = false;
    if (!silent || !isUserEditingDetailForm()) {
      render();
    }
  }
}

async function handleSessionSelect(sessionId) {
  if (!sessionId || state.selectedSessionId === sessionId) return;
  state.selectedSessionId = sessionId;
  state.replyDraft = "";
  state.leadDirty = false;
  state.inquiryDirty = false;
  state.transferDirty = false;
  localStorage.setItem(SELECTED_SESSION_KEY, sessionId);
  render();
  await loadSelectedSession();
}

async function handleTakeOver() {
  if (!state.selectedSessionId || state.busyAction) return;
  if (isViewerRole()) {
    setBanner("warning", "Viewer role is read-only.");
    return;
  }
  if (!state.agentName.trim()) {
    setBanner("error", "Add your agent name before accepting a transfer.");
    return;
  }

  state.busyAction = true;
  render();
  try {
    const detail = await takeOverSession({
      sessionId: state.selectedSessionId,
      agentName: state.agentName.trim(),
    });

    clearAuthBlockedState();
    applySessionDetail(detail);
    setBanner("success", "Live transfer accepted. You are now controlling this session.");
  } catch (error) {
    await handleChatApiError("Accept transfer", error);
  } finally {
    state.busyAction = false;
    render();
  }
}

async function handleRequestTransfer() {
  if (!state.selectedSessionId || state.busyAction) return;
  if (isViewerRole()) {
    setBanner("warning", "Viewer role is read-only.");
    return;
  }
  if (!state.selectedSession?.leadCaptured) {
    setBanner("error", "Capture lead name and email before requesting transfer.");
    return;
  }

  state.busyAction = true;
  render();
  try {
    const reason = state.transferDraft.reason || "manual";
    const note = state.transferDraft.note.trim() || "Support console requested human transfer.";
    const detail = await escalateSupportSession({
      sessionId: state.selectedSessionId,
      reason,
      note,
    });

    clearAuthBlockedState();
    state.transferDirty = false;
    applySessionDetail(detail);
    setBanner("success", "Transfer request queued for human assignment.");
  } catch (error) {
    await handleChatApiError("Request transfer", error);
  } finally {
    state.busyAction = false;
    render();
  }
}

async function handleSendReply() {
  const text = state.replyDraft.trim();
  if (!text || !state.selectedSessionId || state.busyAction) return;
  if (isViewerRole()) {
    setBanner("warning", "Viewer role is read-only.");
    return;
  }
  if (!isHumanSession(state.selectedSession)) {
    setBanner("error", "Accept transfer before sending a human reply.");
    return;
  }

  state.busyAction = true;
  render();
  try {
    const detail = await sendAgentReply({
      sessionId: state.selectedSessionId,
      message: text,
      agentName: state.agentName.trim(),
    });

    clearAuthBlockedState();
    state.replyDraft = "";
    applySessionDetail(detail);
    setBanner("success", "Reply sent.");
  } catch (error) {
    await handleChatApiError("Send reply", error);
  } finally {
    state.busyAction = false;
    render();
  }
}

async function handleSaveLead() {
  if (!state.selectedSessionId || state.busyAction) return;
  if (isViewerRole()) {
    setBanner("warning", "Viewer role is read-only.");
    return;
  }

  const name = state.leadDraft.name.trim();
  const email = state.leadDraft.email.trim();

  if (!name || !email) {
    setBanner("error", "Name and email are required to satisfy lead capture enforcement.");
    return;
  }

  state.busyAction = true;
  render();
  try {
    const detail = await saveLeadForSession({
      sessionId: state.selectedSessionId,
      name,
      email,
      phone: state.leadDraft.phone.trim(),
      company: state.leadDraft.company.trim(),
    });

    clearAuthBlockedState();
    state.leadDirty = false;
    applySessionDetail(detail, { forceDraftSync: true });
    setBanner("success", "Lead details saved.");
  } catch (error) {
    await handleChatApiError("Save lead", error);
  } finally {
    state.busyAction = false;
    render();
  }
}

async function handleSaveInquiry() {
  if (!state.selectedSessionId || state.busyAction) return;
  if (isViewerRole()) {
    setBanner("warning", "Viewer role is read-only.");
    return;
  }

  const summary = state.inquiryDraft.messageSummary.trim();
  if (!summary) {
    setBanner("error", "Inquiry summary is required.");
    return;
  }

  state.busyAction = true;
  render();
  try {
    const detail = await saveInquiryForSession({
      sessionId: state.selectedSessionId,
      messageSummary: summary,
      urgency: state.inquiryDraft.urgency,
      intent: state.inquiryDraft.intent,
    });

    clearAuthBlockedState();
    state.inquiryDirty = false;
    applySessionDetail(detail, { forceDraftSync: true });
    setBanner("success", "Inquiry intake saved.");
  } catch (error) {
    await handleChatApiError("Save inquiry", error);
  } finally {
    state.busyAction = false;
    render();
  }
}

function handleGenerateInquirySummary() {
  const summary = summarizeConversation(state.messages);
  if (!summary) {
    setBanner("error", "Unable to generate summary because the conversation is empty.");
    return;
  }

  state.inquiryDraft.messageSummary = summary;
  state.inquiryDirty = true;
  render();
}

async function handleCloseSession() {
  if (!state.selectedSession || state.busyAction) return;
  if (isViewerRole()) {
    setBanner("warning", "Viewer role is read-only.");
    return;
  }

  const closeCheck = canCloseSession(state.selectedSession);
  if (!closeCheck.ok) {
    setBanner("error", closeCheck.reason);
    return;
  }

  state.busyAction = true;
  render();
  try {
    const detail = await closeSupportSession({
      sessionId: state.selectedSessionId,
      reason: "closed_by_support",
    });

    clearAuthBlockedState();
    applySessionDetail(detail);
    setBanner("success", "Session closed.");
  } catch (error) {
    await handleChatApiError("Close session", error);
  } finally {
    state.busyAction = false;
    render();
  }
}

async function handleCloseNoFollowUp() {
  if (!state.selectedSession || state.busyAction) return;
  if (isViewerRole()) {
    setBanner("warning", "Viewer role is read-only.");
    return;
  }
  if (state.selectedSession.status === "closed") {
    setBanner("warning", "This session is already closed.");
    return;
  }

  const confirmed = window.confirm(
    [
      "Close this session as 'No Follow-up (Anonymous)'?",
      "",
      "This will preserve the record for audit/reporting.",
      "If lead/inquiry data is required, the console will save minimal placeholders automatically before closing.",
    ].join("\n"),
  );
  if (!confirmed) return;

  state.busyAction = true;
  render();

  try {
    let currentSession = state.selectedSession;

    if (!currentSession.leadCaptured) {
      const fallbackName = currentSession.leadName?.trim() || "Anonymous Caller";
      const fallbackEmail =
        currentSession.leadEmail?.trim() ||
        `no-followup+${String(state.selectedSessionId ?? "").trim()}@no-contact.invalid`;
      const leadDetail = await saveLeadForSession({
        sessionId: state.selectedSessionId,
        name: fallbackName,
        email: fallbackEmail,
        phone: currentSession.leadPhone?.trim?.() || "",
        company: currentSession.leadCompany?.trim?.() || "No Follow-up",
      });
      state.leadDirty = false;
      applySessionDetail(leadDetail, { forceDraftSync: true });
      currentSession = leadDetail?.session ?? currentSession;
    }

    if (currentSession.requiresInquiryCapture && !currentSession.inquiryCaptured) {
      const fallbackSummary =
        state.inquiryDraft.messageSummary.trim() ||
        "Anonymous contact completed with no follow-up, callback, or additional action required.";
      const inquiryDetail = await saveInquiryForSession({
        sessionId: state.selectedSessionId,
        messageSummary: fallbackSummary,
        urgency: state.inquiryDraft.urgency || "low",
        intent: state.inquiryDraft.intent || "general",
      });
      state.inquiryDirty = false;
      applySessionDetail(inquiryDetail, { forceDraftSync: true });
      currentSession = inquiryDetail?.session ?? currentSession;
    }

    const detail = await closeSupportSession({
      sessionId: state.selectedSessionId,
      reason: "anonymous_no_follow_up",
    });

    clearAuthBlockedState();
    applySessionDetail(detail);
    setBanner("success", "Session closed as No Follow-up.");
  } catch (error) {
    await handleChatApiError("Close as no follow-up", error);
  } finally {
    state.busyAction = false;
    render();
  }
}

function renderSessionList(sessions) {
  if (state.loadingSessions && sessions.length === 0) {
    return `<div class="empty-state">Loading sessions...</div>`;
  }

  if (state.accessDenied) {
    return `<div class="empty-state">You are signed in, but your account does not have access to support sessions.</div>`;
  }

  if (sessions.length === 0) {
    return `<div class="empty-state">No conversations match the selected filters.</div>`;
  }

  return sessions
    .map((session) => {
      const label = session.leadName || session.leadEmail || "Anonymous visitor";
      const leadState = session.leadCaptured ? "Lead captured" : "Lead missing";
      const tenantLabel = session.tenantName || session.organizationName || session.tenantId || "Unknown tenant";
      const compactTenantLabel = abbreviateMiddle(tenantLabel, { max: 28, keep: 8 });
      const assignedTo = session.assignedToUserId || "Unassigned";
      const isSelected = session.id === state.selectedSessionId;
      return `
        <button class="session-card ${isSelected ? "is-selected" : ""}" data-session-id="${escapeHtml(
          session.id,
        )}">
          <div class="session-card-row">
            <strong class="session-title">${escapeHtml(label)}</strong>
            <span class="${statusClass(session.status)}">${statusLabel(session.status)}</span>
          </div>
          <div class="session-card-row">
            <span class="badge badge-product">${escapeHtml(productLabelFromKey(session.productKey))}</span>
            <span class="session-tenant" title="${escapeHtml(tenantLabel)}">${escapeHtml(compactTenantLabel)}</span>
          </div>
          <div class="session-subline">
            <span>${escapeHtml(leadState)} | ${escapeHtml(session.inquiryUrgency || "n/a")} urgency</span>
            <span>${escapeHtml(assignedTo)}</span>
          </div>
          <p class="session-preview">${escapeHtml(
            session.lastMessagePreview || "No message preview available.",
          )}</p>
          <div class="session-time">${formatTimestamp(session.updatedAt)}</div>
        </button>
      `;
    })
    .join("");
}

function renderMessages(messages) {
  if (!messages.length) {
    return `<div class="empty-state">No conversation messages yet.</div>`;
  }

  return messages
    .map((message) => {
      const bubbleClass = `message message-${message.sender}`;
      const senderLabel =
        message.sender === "visitor"
          ? "Visitor"
          : message.sender === "agent"
            ? "Agent"
            : message.sender === "ai"
              ? "AI"
              : "System";
      return `
        <article class="${bubbleClass}">
          <header>
            <span>${senderLabel}</span>
            <time>${formatTimestamp(message.createdAt)}</time>
          </header>
          <p>${escapeHtml(message.body || "(empty message)")}</p>
        </article>
      `;
    })
    .join("");
}

function renderDiagnosticsPanel() {
  const traces = getChatEndpointTrace();
  const entries = Object.entries(traces);
  if (!entries.length) {
    return `
      <section class="diagnostics-panel">
        <header>
          <h3>API Diagnostics</h3>
          <p>No endpoint traces yet. Actions will appear after API calls run.</p>
        </header>
      </section>
    `;
  }

  const sortedEntries = entries.sort(
    (a, b) => Date.parse(b[1]?.at ?? 0) - Date.parse(a[1]?.at ?? 0),
  );

  return `
    <section class="diagnostics-panel">
      <header>
        <h3>API Diagnostics</h3>
        <p>Resolved endpoint for each console action.</p>
      </header>
      <div class="diagnostics-table-wrap">
        <table class="diagnostics-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Status</th>
              <th>Error Code</th>
              <th>Required Action</th>
              <th>Endpoint</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            ${sortedEntries
              .map(([key, trace]) => {
                const action = TRACE_LABELS[key] ?? key;
                const endpoint = trace?.path ? `${trace.method ?? "GET"} ${trace.path}` : "n/a";
                return `
                  <tr>
                    <td>${escapeHtml(action)}</td>
                    <td><span class="diag-status diag-status-${escapeHtml(trace?.status ?? "unknown")}">${escapeHtml(
                      trace?.status ?? "unknown",
                    )}</span></td>
                    <td><code>${escapeHtml(trace?.code ?? "-")}</code></td>
                    <td>${escapeHtml(trace?.requiredAction ?? "-")}</td>
                    <td><code>${escapeHtml(endpoint)}</code></td>
                    <td>${formatTimestamp(trace?.at)}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDetailPanel() {
  if (!state.selectedSessionId) {
    return `
      <section class="detail-empty">
        <h2>Select a session to begin</h2>
        <p>Transfers needing human follow-up will appear in the queue automatically.</p>
      </section>
    `;
  }

  const session = state.selectedSession ?? state.sessions.find((item) => item.id === state.selectedSessionId);
  if (!session) {
    return `
      <section class="detail-empty">
        <h2>Session not loaded yet</h2>
        <p>Choose another session or refresh.</p>
      </section>
    `;
  }

  const closeCheck = canCloseSession(session);
  const readOnly = isViewerRole();
  const canTakeOver = !readOnly && session.status === "escalated";
  const canRequestTransfer = !readOnly && session.status === "active_ai";
  const canReply = !readOnly && session.status === "active_human";
  const canEditIntake = !readOnly;
  const canCloseNoFollowUp = !readOnly && session.status !== "closed";
  const tenantLabel = session.tenantName || session.organizationName || session.tenantId || "Unknown";
  const tenantIdTooltip = session.tenantId
    ? `Tenant ID: ${session.tenantId}`
    : "Tenant ID is not available for this session.";
  const closeActionHint = readOnly
    ? "Viewer role is read-only. You cannot close sessions."
    : closeCheck.ok
      ? "To set status to Closed, click Close Session."
      : `${closeCheck.reason} If no follow-up is needed, use Close No Follow-up.`;
  const leadNeedsAttention = !session.leadCaptured || state.leadDirty;
  const inquiryNeedsAttention =
    (session.requiresInquiryCapture && !session.inquiryCaptured) || state.inquiryDirty;
  const inquiryStateLabel = !session.requiresInquiryCapture
    ? "Not required"
    : session.inquiryCaptured
      ? "Captured"
      : "Required";
  const readinessItems = [
    {
      label: "Lead captured",
      complete: Boolean(session.leadCaptured),
    },
    {
      label: "Inquiry captured",
      complete: !session.requiresInquiryCapture || Boolean(session.inquiryCaptured),
    },
    {
      label: "Transfer requested",
      complete: isSessionEscalated(session),
    },
    {
      label: "Human accepted",
      complete: isHumanSession(session),
    },
  ];

  return `
    <section class="detail-shell">
      <header class="detail-header">
        <div>
          <h2>Session ${escapeHtml(session.id)}</h2>
          <p>${escapeHtml(productLabelFromKey(session.productKey))} | ${escapeHtml(tenantLabel)}</p>
          <p class="close-action-hint">${escapeHtml(closeActionHint)}</p>
        </div>
        <div class="detail-actions">
          <button id="takeover-button" class="button button-primary" ${canTakeOver && !state.busyAction ? "" : "disabled"}>
            Accept Transfer
          </button>
          <button
            id="close-no-followup-button"
            class="button button-warning"
            title="Close anonymous/no-follow-up sessions with confirmation"
            ${canCloseNoFollowUp && !state.busyAction ? "" : "disabled"}
          >
            Close No Follow-up
          </button>
          <button
            id="close-button"
            class="button button-quiet"
            title="${escapeHtml(closeActionHint)}"
            ${!readOnly && closeCheck.ok && !state.busyAction ? "" : "disabled"}
          >
            Close Session
          </button>
        </div>
      </header>

      <dl class="session-facts">
        <div><dt>Product</dt><dd>${escapeHtml(productLabelFromKey(session.productKey))}</dd></div>
        <div><dt>Tenant/Customer</dt><dd><span class="tenant-hover-chip" title="${escapeHtml(tenantIdTooltip)}">${escapeHtml(tenantLabel)}</span></dd></div>
        <div><dt>Organization</dt><dd>${escapeHtml(session.organizationName || "n/a")}</dd></div>
        <div><dt>Source App</dt><dd>${escapeHtml(session.sourceApp || session.source || "n/a")}</dd></div>
        <div><dt>Status</dt><dd>${statusLabel(session.status)}</dd></div>
        <div><dt>Lead</dt><dd>${session.leadCaptured ? "Captured" : "Missing"}</dd></div>
        <div><dt>Inquiry</dt><dd>${session.inquiryCaptured ? "Captured" : "Not captured"}</dd></div>
        <div><dt>Owner</dt><dd>${escapeHtml(session.assignedToUserId || state.agentName || "Unassigned")}</dd></div>
      </dl>

      <section class="intake-accordion">
        <details class="intake-panel" ${leadNeedsAttention ? "open" : ""}>
          <summary>
            <span>Lead Capture</span>
            <strong>${session.leadCaptured ? "Captured" : "Required"}</strong>
          </summary>
          <form id="lead-form" class="intake-form">
            <p>Name + email required before close.</p>
            <label>
              Name
              <input id="lead-name-input" value="${escapeHtml(state.leadDraft.name)}" placeholder="Full name" ${canEditIntake ? "" : "disabled"} />
            </label>
            <label>
              Email
              <input id="lead-email-input" type="email" value="${escapeHtml(state.leadDraft.email)}" placeholder="name@example.com" ${canEditIntake ? "" : "disabled"} />
            </label>
            <label>
              Phone
              <input id="lead-phone-input" value="${escapeHtml(state.leadDraft.phone)}" placeholder="Optional" ${canEditIntake ? "" : "disabled"} />
            </label>
            <label>
              Company
              <input id="lead-company-input" value="${escapeHtml(state.leadDraft.company)}" placeholder="Optional" ${canEditIntake ? "" : "disabled"} />
            </label>
            <button class="button button-primary" type="submit" ${state.busyAction || !canEditIntake ? "disabled" : ""}>Save Lead</button>
          </form>
        </details>

        <details class="intake-panel" ${inquiryNeedsAttention ? "open" : ""}>
          <summary>
            <span>Inquiry Intake</span>
            <strong>${escapeHtml(inquiryStateLabel)}</strong>
          </summary>
          <form id="inquiry-form" class="intake-form">
            <p>Required after hours before close.</p>
            <label>
              Summary
              <textarea id="inquiry-summary-input" rows="3" placeholder="Describe request or issue..." ${canEditIntake ? "" : "disabled"}>${escapeHtml(
                state.inquiryDraft.messageSummary,
              )}</textarea>
            </label>
            <label>
              Urgency
              <select id="inquiry-urgency-input" ${canEditIntake ? "" : "disabled"}>
                ${URGENCY_OPTIONS.map(
                  (option) => `<option value="${option}" ${state.inquiryDraft.urgency === option ? "selected" : ""}>${option}</option>`,
                ).join("")}
              </select>
            </label>
            <label>
              Intent
              <select id="inquiry-intent-input" ${canEditIntake ? "" : "disabled"}>
                ${INTENT_OPTIONS.map(
                  (option) => `<option value="${option}" ${state.inquiryDraft.intent === option ? "selected" : ""}>${option}</option>`,
                ).join("")}
              </select>
            </label>
            <button class="button button-primary" type="submit" ${state.busyAction || !canEditIntake ? "disabled" : ""}>Save Inquiry</button>
            <button id="inquiry-auto-summary-button" class="button button-quiet" type="button" ${state.busyAction || !canEditIntake ? "disabled" : ""}>Generate From Chat</button>
          </form>
        </details>
      </section>

      <section class="readiness-grid">
        ${readinessItems
          .map(
            (item) => `
              <div class="readiness-item ${item.complete ? "is-complete" : "is-pending"}">
                <span>${item.complete ? "Completed" : "Pending"}</span>
                <strong>${escapeHtml(item.label)}</strong>
              </div>
            `,
          )
          .join("")}
        ${
          session.escalationReason
            ? `<div class="readiness-reason">Reason: ${escapeHtml(session.escalationReason)}</div>`
            : ""
        }
      </section>

      ${readOnly ? `<p class="validation-note">Viewer role is read-only. Session actions are disabled.</p>` : ""}

      ${
        canRequestTransfer
          ? `
            <form id="transfer-request-form" class="transfer-request-form">
              <label>
                Transfer reason
                <select id="transfer-reason-input">
                  ${ESCALATION_REASONS.map(
                    (reason) => `<option value="${reason}" ${state.transferDraft.reason === reason ? "selected" : ""}>${reason}</option>`,
                  ).join("")}
                </select>
              </label>
              <label>
                Internal note
                <textarea id="transfer-note-input" rows="2" placeholder="Optional transfer context for the human agent.">${escapeHtml(
                  state.transferDraft.note,
                )}</textarea>
              </label>
              <button id="request-transfer-button" class="button" type="submit" ${!state.busyAction ? "" : "disabled"}>
                Request Transfer
              </button>
            </form>
          `
          : ""
      }

      ${
        closeCheck.ok ? "" : `<p class="validation-note">${escapeHtml(closeCheck.reason)}</p>`
      }

      <div class="conversation">${renderMessages(state.messages)}</div>

      <form id="reply-form" class="reply-form">
        <label for="reply-input">Human response</label>
        <textarea
          id="reply-input"
          rows="3"
          placeholder="${readOnly ? "Viewer role cannot reply." : canReply ? "Type your message to the visitor..." : "Accept transfer before replying."}"
          ${canReply ? "" : "disabled"}
        >${escapeHtml(state.replyDraft)}</textarea>
        <div class="reply-footer">
          <span>Do not ask for passwords, card numbers, or sensitive personal data.</span>
          <button class="button button-primary" type="submit" ${canReply ? "" : "disabled"}>Send Reply</button>
        </div>
      </form>
    </section>
  `;
}

function render() {
  if (!state.isAuthenticated || state.authBlocked) {
    renderAuthScreen();
    return;
  }

  const filteredSessions = filterSessions(state.sessions, state.filter, state.search);
  const transferQueueCount = state.sessions.filter(
    (session) => isSessionEscalated(session) && session.status !== "closed",
  ).length;
  const products = state.productOptions.length ? state.productOptions : FALLBACK_PRODUCTS;

  app.innerHTML = `
    <div class="console-root">
      <header class="topbar">
        <div>
          <h1>Workside Support Console</h1>
          <p>Live transfer-to-human operations</p>
        </div>
        <div class="status-strip">
          <span class="${realtimeStatusClass(state.realtimeStatus)}"></span>
          <span>${realtimeStatusLabel(state.realtimeStatus)}</span>
          <span class="queue-pill">Queue ${transferQueueCount}</span>
          <span class="queue-pill">${escapeHtml(state.userRole || "role:unknown")}</span>
        </div>
        <form id="settings-form" class="settings-form">
          <label>
            Product
            <select id="support-filter-product">
              <option value="">All Products</option>
              ${products
                .map(
                  (product) => `<option value="${escapeHtml(product.id)}" ${
                    state.supportFilters.product === product.id ? "selected" : ""
                  }>${escapeHtml(product.label)}</option>`,
                )
                .join("")}
            </select>
          </label>
          <label>
            Tenant/Customer
            <select id="support-filter-tenant">
              <option value="">All Customers</option>
              ${state.tenantOptions
                .map(
                  (tenant) => `<option value="${escapeHtml(tenant.id)}" ${
                    state.supportFilters.tenantId === tenant.id ? "selected" : ""
                  }>${escapeHtml(tenant.name)}</option>`,
                )
                .join("")}
            </select>
          </label>
          <label>
            Status
            <select id="support-filter-status">
              <option value="">All Statuses</option>
              ${SESSION_STATUS_OPTIONS.map(
                (status) => `<option value="${status}" ${
                  state.supportFilters.status === status ? "selected" : ""
                }>${escapeHtml(statusLabel(status))}</option>`,
              ).join("")}
            </select>
          </label>
          <label>
            Urgency
            <select id="support-filter-urgency">
              <option value="">All</option>
              ${URGENCY_OPTIONS.map(
                (option) => `<option value="${option}" ${
                  state.supportFilters.urgency === option ? "selected" : ""
                }>${escapeHtml(option)}</option>`,
              ).join("")}
            </select>
          </label>
          <label>
            Assigned To
            <input id="support-filter-assigned-to" value="${escapeHtml(
              state.supportFilters.assignedTo,
            )}" placeholder="All" />
          </label>
          <label>
            Agent Name
            <input id="agent-input" value="${escapeHtml(state.agentName)}" placeholder="Your name" />
          </label>
          <button id="diagnostics-toggle-button" class="button" type="button">
            ${state.showDiagnostics ? "Hide Diagnostics" : "Show Diagnostics"}
          </button>
          <button id="logout-button" class="button" type="button">Logout</button>
          <button id="refresh-button" class="button" type="button">Refresh</button>
        </form>
      </header>

      ${
        state.banner
          ? `<div class="banner banner-${escapeHtml(state.banner.type)}">${escapeHtml(state.banner.text)}</div>`
          : ""
      }
      ${
        state.authBlocked
          ? `<div class="banner banner-warning">Auth issue: ${escapeHtml(
              state.authMessage || "Your session is expired. Re-authenticate to continue.",
            )}</div>`
          : ""
      }
      ${
        state.accessDenied
          ? `<div class="banner banner-warning">You are signed in, but your account does not have access to support sessions.</div>`
          : ""
      }

      <main class="layout">
        <aside class="sessions-panel">
          <div class="sessions-header">
            <h2>Sessions</h2>
            <span>${state.lastUpdatedAt ? `Updated ${formatTimestamp(state.lastUpdatedAt)}` : "Not loaded yet"}</span>
          </div>
          <div class="search-wrap">
            <input id="search-input" placeholder="Search by lead, preview, or session id" value="${escapeHtml(
              state.search,
            )}" />
          </div>
          <div class="session-list">${renderSessionList(filteredSessions)}</div>
        </aside>
        <section class="detail-panel">${renderDetailPanel()}</section>
      </main>
      ${state.showDiagnostics ? renderDiagnosticsPanel() : ""}
    </div>
  `;

  bindEvents();
}

function bindEvents() {
  const searchInput = document.querySelector("#search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      state.search = event.target.value;
      render();
    });
  }

  const settingsForm = document.querySelector("#settings-form");
  if (settingsForm) {
    settingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
    });
  }

  const productFilterInput = document.querySelector("#support-filter-product");
  if (productFilterInput) {
    productFilterInput.addEventListener("change", async (event) => {
      state.supportFilters.product = String(event.target.value ?? "").trim();
      state.supportFilters.tenantId = "";
      state.accessDenied = false;
      persistFilters();
      await loadFilterOptions({ silent: true });
      await loadSessions();
      await loadSelectedSession();
    });
  }

  const tenantFilterInput = document.querySelector("#support-filter-tenant");
  if (tenantFilterInput) {
    tenantFilterInput.addEventListener("change", async (event) => {
      state.supportFilters.tenantId = String(event.target.value ?? "").trim();
      state.accessDenied = false;
      persistFilters();
      await loadSessions();
      await loadSelectedSession();
    });
  }

  const statusFilterInput = document.querySelector("#support-filter-status");
  if (statusFilterInput) {
    statusFilterInput.addEventListener("change", async (event) => {
      state.supportFilters.status = String(event.target.value ?? "").trim();
      state.accessDenied = false;
      persistFilters();
      await loadSessions();
      await loadSelectedSession();
    });
  }

  const urgencyFilterInput = document.querySelector("#support-filter-urgency");
  if (urgencyFilterInput) {
    urgencyFilterInput.addEventListener("change", async (event) => {
      state.supportFilters.urgency = String(event.target.value ?? "").trim();
      state.accessDenied = false;
      persistFilters();
      await loadSessions();
      await loadSelectedSession();
    });
  }

  const assignedFilterInput = document.querySelector("#support-filter-assigned-to");
  if (assignedFilterInput) {
    assignedFilterInput.addEventListener("change", async (event) => {
      state.supportFilters.assignedTo = String(event.target.value ?? "").trim();
      state.accessDenied = false;
      persistFilters();
      await loadSessions();
      await loadSelectedSession();
    });
  }

  const agentInput = document.querySelector("#agent-input");
  if (agentInput) {
    agentInput.addEventListener("change", (event) => {
      state.agentName = event.target.value.trim();
      localStorage.setItem(AGENT_STORAGE_KEY, state.agentName);
      render();
    });
  }

  document.querySelectorAll("[data-session-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await handleSessionSelect(button.getAttribute("data-session-id"));
    });
  });

  const refreshButton = document.querySelector("#refresh-button");
  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      await loadSessions();
      await loadSelectedSession();
    });
  }

  const diagnosticsToggleButton = document.querySelector("#diagnostics-toggle-button");
  if (diagnosticsToggleButton) {
    diagnosticsToggleButton.addEventListener("click", () => {
      state.showDiagnostics = !state.showDiagnostics;
      render();
    });
  }

  const logoutButton = document.querySelector("#logout-button");
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      await handleLogout();
    });
  }

  const takeoverButton = document.querySelector("#takeover-button");
  if (takeoverButton) {
    takeoverButton.addEventListener("click", handleTakeOver);
  }

  const transferReasonInput = document.querySelector("#transfer-reason-input");
  if (transferReasonInput) {
    transferReasonInput.addEventListener("change", (event) => {
      state.transferDraft.reason = event.target.value;
      state.transferDirty = true;
    });
  }

  const transferNoteInput = document.querySelector("#transfer-note-input");
  if (transferNoteInput) {
    transferNoteInput.addEventListener("input", (event) => {
      state.transferDraft.note = event.target.value;
      state.transferDirty = true;
    });
  }

  const transferRequestForm = document.querySelector("#transfer-request-form");
  if (transferRequestForm) {
    transferRequestForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleRequestTransfer();
    });
  }

  const closeButton = document.querySelector("#close-button");
  if (closeButton) {
    closeButton.addEventListener("click", handleCloseSession);
  }

  const closeNoFollowUpButton = document.querySelector("#close-no-followup-button");
  if (closeNoFollowUpButton) {
    closeNoFollowUpButton.addEventListener("click", handleCloseNoFollowUp);
  }

  const replyInput = document.querySelector("#reply-input");
  if (replyInput) {
    replyInput.addEventListener("input", (event) => {
      state.replyDraft = event.target.value;
    });
  }

  const replyForm = document.querySelector("#reply-form");
  if (replyForm) {
    replyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleSendReply();
    });
  }

  const leadNameInput = document.querySelector("#lead-name-input");
  if (leadNameInput) {
    leadNameInput.addEventListener("input", (event) => {
      state.leadDraft.name = event.target.value;
      state.leadDirty = true;
    });
  }

  const leadEmailInput = document.querySelector("#lead-email-input");
  if (leadEmailInput) {
    leadEmailInput.addEventListener("input", (event) => {
      state.leadDraft.email = event.target.value;
      state.leadDirty = true;
    });
  }

  const leadPhoneInput = document.querySelector("#lead-phone-input");
  if (leadPhoneInput) {
    leadPhoneInput.addEventListener("input", (event) => {
      state.leadDraft.phone = event.target.value;
      state.leadDirty = true;
    });
  }

  const leadCompanyInput = document.querySelector("#lead-company-input");
  if (leadCompanyInput) {
    leadCompanyInput.addEventListener("input", (event) => {
      state.leadDraft.company = event.target.value;
      state.leadDirty = true;
    });
  }

  const leadForm = document.querySelector("#lead-form");
  if (leadForm) {
    leadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleSaveLead();
    });
  }

  const inquirySummaryInput = document.querySelector("#inquiry-summary-input");
  if (inquirySummaryInput) {
    inquirySummaryInput.addEventListener("input", (event) => {
      state.inquiryDraft.messageSummary = event.target.value;
      state.inquiryDirty = true;
    });
  }

  const inquiryUrgencyInput = document.querySelector("#inquiry-urgency-input");
  if (inquiryUrgencyInput) {
    inquiryUrgencyInput.addEventListener("change", (event) => {
      state.inquiryDraft.urgency = event.target.value;
      state.inquiryDirty = true;
    });
  }

  const inquiryIntentInput = document.querySelector("#inquiry-intent-input");
  if (inquiryIntentInput) {
    inquiryIntentInput.addEventListener("change", (event) => {
      state.inquiryDraft.intent = event.target.value;
      state.inquiryDirty = true;
    });
  }

  const inquiryForm = document.querySelector("#inquiry-form");
  if (inquiryForm) {
    inquiryForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleSaveInquiry();
    });
  }

  const inquiryAutoSummaryButton = document.querySelector("#inquiry-auto-summary-button");
  if (inquiryAutoSummaryButton) {
    inquiryAutoSummaryButton.addEventListener("click", handleGenerateInquirySummary);
  }
}

async function bootstrap() {
  await initializeAuthBridge();

  const persistedToken = getStoredToken();
  state.authTokenDraft = persistedToken;
  state.isAuthenticated = Boolean(persistedToken);

  render();

  if (state.isAuthenticated) {
    await completeAuthenticatedStartup();
  }
}

window.addEventListener("beforeunload", () => {
  stopRealtimeAndPolling();
});

bootstrap();

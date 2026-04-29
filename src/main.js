import "./style.css";
import {
  assignSupportSession,
  closeSupportSession,
  createSupportDepartment,
  createSupportUser,
  deleteSupportDepartment,
  escalateSupportSession,
  getChatEndpointTrace,
  getSupportSession,
  isHumanSession,
  isSessionEscalated,
  listSupportProducts,
  listSupportSessions,
  listSupportTenants,
  listSupportDepartments,
  listSupportUsers,
  saveInquiryForSession,
  saveLeadForSession,
  sendTranscriptForSession,
  sendAgentReply,
  takeOverSession,
  updateSupportDepartment,
  updateSupportUser,
} from "./services/chat";
import { isAuthErrorCode, parseChatApiError, shouldRefreshSession } from "./services/chatErrors";
import {
  getStoredToken,
  hasFirebaseAuthConfig,
  initializeAuthBridge,
  refreshStoredFirebaseToken,
  setStoredToken,
  signInWithFirebaseCredentials,
  signOutAllAuth,
} from "./services/auth";

const AGENT_STORAGE_KEY = "workside_support_agent";
const SELECTED_SESSION_KEY = "workside_selected_session";
const FILTERS_STORAGE_KEY = "workside_support_filters";
const USER_ROLE_STORAGE_KEY = "workside_support_role";

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
  "FILTER_ACCESS_DENIED",
]);
const POLLING_INTERVAL_MS = 5000;
const DETAIL_EDITABLE_IDS = new Set([
  "support-filter-product",
  "support-filter-tenant",
  "support-filter-status",
  "support-filter-urgency",
  "support-filter-assigned-to",
  "agent-input",
  "assign-department-input",
  "assign-user-input",
  "assign-note-input",
  "transcript-to-input",
  "transcript-subject-input",
  "transcript-ai-input",
  "transcript-agent-input",
  "transcript-system-input",
  "admin-user-name-input",
  "admin-user-email-input",
  "admin-user-phone-input",
  "admin-user-role-input",
  "admin-user-departments-input",
  "admin-user-products-input",
  "admin-user-tenants-input",
  "admin-user-active-input",
  "admin-department-id-input",
  "admin-department-label-input",
  "admin-department-product-input",
  "admin-department-defaults-input",
  "admin-department-active-input",
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

function isSuperAdminRole() {
  return String(state.userRole ?? "").toLowerCase() === "super_admin";
}

async function refreshUserRole() {
  const authRef = window?.firebaseAuth;
  const currentUser = authRef?.currentUser;
  if (!currentUser || typeof currentUser.getIdTokenResult !== "function") {
    return Boolean(state.userRole);
  }
  try {
    const tokenResult = await currentUser.getIdTokenResult();
    const claims = tokenResult?.claims ?? {};
    const claimRole = claims.role ?? claims.supportRole ?? claims.userRole ?? "";
    const normalizedRole = String(claimRole ?? "").trim();
    if (normalizedRole) {
      state.userRole = normalizedRole;
      localStorage.setItem(USER_ROLE_STORAGE_KEY, normalizedRole);
      return true;
    }

    const hasExplicitRoleClaim =
      Object.prototype.hasOwnProperty.call(claims, "role") ||
      Object.prototype.hasOwnProperty.call(claims, "supportRole") ||
      Object.prototype.hasOwnProperty.call(claims, "userRole");

    if (hasExplicitRoleClaim) {
      state.userRole = "";
      localStorage.removeItem(USER_ROLE_STORAGE_KEY);
    }
    return Boolean(state.userRole);
  } catch {
    // Keep last known role to avoid role flicker caused by transient auth timing.
    return Boolean(state.userRole);
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
  knownSessionIds: new Set(),
  sessionSoundReady: false,
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
  sessionListScrollTop: 0,
  detailPanelScrollTop: 0,
  intakePanelStateBySession: {},
  closeRequirementsBySession: {},
  noFollowUpDisabledScopes: {},
  adminPanelOpen: false,
  adminUsers: [],
  adminDepartments: [],
  adminLoading: false,
  adminError: "",
  adminDialog: {
    open: false,
    type: "",
    mode: "create",
    id: "",
    name: "",
    email: "",
    phone: "",
    role: "support_agent",
    departments: "",
    allowedProducts: "",
    allowedTenantIds: "",
    active: true,
    label: "",
    product: "",
    defaultAssigneeIds: "",
  },
  assignmentOptions: {
    users: [],
    departments: [],
    loading: false,
    error: "",
  },
  assignDialog: {
    open: false,
    departmentId: "",
    assignedToUserId: "",
    note: "",
    notifyAssignee: true,
    includeTranscriptSummary: true,
  },
  transcriptDialog: {
    open: false,
    to: "",
    subject: "Your conversation transcript",
    includeAiMessages: true,
    includeAgentMessages: true,
    includeSystemMessages: false,
  },
  confirmDialog: {
    open: false,
    title: "",
    lines: [],
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    confirmTone: "primary",
  },
  userRole: localStorage.getItem(USER_ROLE_STORAGE_KEY) ?? "",
};

let bannerTimer = null;
let pollingInterval = null;
let pollingInFlight = false;
let confirmDialogResolver = null;
let notificationAudioContext = null;

function closeConfirmDialog(result = false) {
  if (typeof confirmDialogResolver === "function") {
    confirmDialogResolver(Boolean(result));
    confirmDialogResolver = null;
  }
  state.confirmDialog = {
    open: false,
    title: "",
    lines: [],
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    confirmTone: "primary",
  };
  render();
}

function unlockNotificationSound() {
  if (state.sessionSoundReady) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    notificationAudioContext = notificationAudioContext || new AudioContextClass();
    if (notificationAudioContext.state === "suspended") {
      notificationAudioContext.resume().catch(() => {});
    }
    state.sessionSoundReady = true;
  } catch {
    state.sessionSoundReady = false;
  }
}

function playNewSessionSound() {
  if (!state.sessionSoundReady) return;
  const audioContext = notificationAudioContext;
  if (!audioContext) return;
  try {
    const startedAt = audioContext.currentTime;
    const gain = audioContext.createGain();
    const oscillator = audioContext.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, startedAt);
    gain.gain.setValueAtTime(0.0001, startedAt);
    gain.gain.exponentialRampToValueAtTime(0.08, startedAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.28);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startedAt);
    oscillator.stop(startedAt + 0.3);
  } catch {
    // Audio notification is best-effort; visual banner remains the source of truth.
  }
}

async function requestConfirmationDialog({
  title,
  lines,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmTone = "primary",
} = {}) {
  if (typeof confirmDialogResolver === "function") {
    confirmDialogResolver(false);
    confirmDialogResolver = null;
  }

  state.confirmDialog = {
    open: true,
    title: String(title ?? "Please Confirm"),
    lines: Array.isArray(lines) ? lines.map((line) => String(line ?? "")) : [],
    confirmLabel: String(confirmLabel),
    cancelLabel: String(cancelLabel),
    confirmTone: confirmTone === "warning" ? "warning" : "primary",
  };
  render();

  return new Promise((resolve) => {
    confirmDialogResolver = resolve;
  });
}

function isUserEditingDetailForm() {
  const active = document.activeElement;
  if (!active) return false;
  const tagName = String(active.tagName ?? "").toUpperCase();
  if (tagName !== "INPUT" && tagName !== "TEXTAREA" && tagName !== "SELECT") {
    return false;
  }
  return DETAIL_EDITABLE_IDS.has(active.id);
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
  if (state.busyAction) return;
  if (state.confirmDialog?.open) return;
  if (isUserEditingDetailForm()) return;
  pollingInFlight = true;
  try {
    if (!state.userRole) {
      const hadRole = Boolean(state.userRole);
      await refreshUserRole();
      if (!hadRole && state.userRole) {
        render();
      }
    }
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

function roleBadgeLabel() {
  if (state.userRole) return state.userRole;
  if (state.isAuthenticated) return "role:loading";
  return "role:unknown";
}

function buildScopeKey({ tenantId, product } = {}) {
  const tenant = String(tenantId ?? "").trim() || "unknown_tenant";
  const productKey = String(product ?? "").trim() || "unknown_product";
  return `${productKey}::${tenant}`;
}

function noFollowUpScopeKeyForSession(session) {
  return buildScopeKey({
    tenantId: session?.tenantId,
    product: session?.productKey,
  });
}

function syncNoFollowUpScopeCapability(session) {
  if (!session) return;
  const explicitCapability = session.allowAnonymousNoFollowUpClose;
  if (typeof explicitCapability !== "boolean") return;

  const scopeKey = noFollowUpScopeKeyForSession(session);
  if (explicitCapability) {
    if (!state.noFollowUpDisabledScopes[scopeKey]) return;
    const next = { ...state.noFollowUpDisabledScopes };
    delete next[scopeKey];
    state.noFollowUpDisabledScopes = next;
    return;
  }

  if (state.noFollowUpDisabledScopes[scopeKey]) return;
  state.noFollowUpDisabledScopes = {
    ...state.noFollowUpDisabledScopes,
    [scopeKey]: true,
  };
}

function disableNoFollowUpForCurrentScope() {
  const scopeKey = noFollowUpScopeKeyForSession(getSelectedSessionContext());
  if (state.noFollowUpDisabledScopes[scopeKey]) return;
  state.noFollowUpDisabledScopes = {
    ...state.noFollowUpDisabledScopes,
    [scopeKey]: true,
  };
}

function isNoFollowUpDisabledForSession(session) {
  if (!session) return false;
  if (session.allowAnonymousNoFollowUpClose === false) return true;
  const scopeKey = noFollowUpScopeKeyForSession(session);
  return Boolean(state.noFollowUpDisabledScopes[scopeKey]);
}

function getSelectedSessionContext() {
  if (!state.selectedSessionId) return state.selectedSession ?? null;
  if (state.selectedSession?.id === state.selectedSessionId) return state.selectedSession;
  const fromList = state.sessions.find((item) => item.id === state.selectedSessionId);
  return fromList ?? state.selectedSession ?? null;
}

function sessionIntakePanelState(sessionId) {
  if (!sessionId) return {};
  const panels = state.intakePanelStateBySession?.[sessionId];
  return panels && typeof panels === "object" ? panels : {};
}

function setIntakePanelOpenState(sessionId, panelKey, isOpen) {
  if (!sessionId || !panelKey) return;
  const current = sessionIntakePanelState(sessionId);
  state.intakePanelStateBySession = {
    ...state.intakePanelStateBySession,
    [sessionId]: {
      ...current,
      [panelKey]: Boolean(isOpen),
    },
  };
}

function sessionCloseRequirements(sessionId) {
  if (!sessionId) return {};
  const requirements = state.closeRequirementsBySession?.[sessionId];
  return requirements && typeof requirements === "object" ? requirements : {};
}

function markSessionCloseRequirement(sessionId, requirementKey, required = true) {
  if (!sessionId || !requirementKey) return;
  const current = sessionCloseRequirements(sessionId);
  state.closeRequirementsBySession = {
    ...state.closeRequirementsBySession,
    [sessionId]: {
      ...current,
      [requirementKey]: Boolean(required),
    },
  };
}

function syncSessionCloseRequirements(session) {
  if (!session?.id) return;
  const current = sessionCloseRequirements(session.id);
  const next = { ...current };
  let changed = false;

  if (hasRequiredLeadIdentity(session) && next.leadRequired) {
    delete next.leadRequired;
    changed = true;
  }
  if (session.inquiryCaptured && next.inquiryRequired) {
    delete next.inquiryRequired;
    changed = true;
  }

  if (!changed) return;
  state.closeRequirementsBySession = {
    ...state.closeRequirementsBySession,
    [session.id]: next,
  };
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
  list_support_users: "List Support Users",
  list_support_departments: "List Departments",
  list_admin_support_users: "Admin Users",
  list_admin_support_departments: "Admin Departments",
  create_admin_support_user: "Create Support User",
  update_admin_support_user: "Update Support User",
  create_admin_support_department: "Create Department",
  update_admin_support_department: "Update Department",
  delete_admin_support_department: "Delete Department",
  send_session_transcript: "Send Transcript",
  assign_support_session: "Assign Session",
};

function setBanner(type, text) {
  state.banner = { type, text };
  render();
  if (bannerTimer) clearTimeout(bannerTimer);
  const clearBanner = () => {
    if (isUserEditingDetailForm()) {
      bannerTimer = setTimeout(clearBanner, 1000);
      return;
    }
    state.banner = null;
    render();
  };
  bannerTimer = setTimeout(clearBanner, 5000);
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

function captureSessionListScroll() {
  const list = app?.querySelector(".session-list");
  if (!list) return;
  state.sessionListScrollTop = list.scrollTop;
}

function restoreSessionListScroll() {
  const list = app?.querySelector(".session-list");
  if (!list) return;
  if (!Number.isFinite(state.sessionListScrollTop)) return;
  list.scrollTop = state.sessionListScrollTop;
}

function scrollSelectedSessionIntoView({ force = false } = {}) {
  const list = app?.querySelector(".session-list");
  if (!list || !state.selectedSessionId) return;
  const selector = `[data-session-id="${CSS.escape(state.selectedSessionId)}"]`;
  const selected = list.querySelector(selector);
  if (!selected) return;

  const listRect = list.getBoundingClientRect();
  const selectedRect = selected.getBoundingClientRect();
  const isFullyVisible = selectedRect.top >= listRect.top && selectedRect.bottom <= listRect.bottom;
  if (!force && isFullyVisible) return;

  const targetTop = Math.max(0, list.scrollTop + selectedRect.top - listRect.top - 12);
  list.scrollTo({
    top: targetTop,
    behavior: force ? "smooth" : "auto",
  });
  state.sessionListScrollTop = targetTop;
}

function supportUserDisplayLabel(user) {
  if (!user) return "Unknown user";
  const email = String(user.email ?? "").trim();
  return email ? `${user.name} (${email})` : user.name;
}

function hasSendableTranscriptMessages(session) {
  if (state.messages.some((message) => String(message.body ?? "").trim())) {
    return true;
  }
  return Number(session?.messageCount ?? 0) > 0;
}

function csvToList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToCsv(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function activeAdminDepartments() {
  return state.adminDepartments.filter((department) => department.active !== false);
}

function departmentExists(departmentId, { excludingId = "" } = {}) {
  const normalizedId = String(departmentId ?? "").trim().toLowerCase();
  const ignoredId = String(excludingId ?? "").trim().toLowerCase();
  if (!normalizedId) return false;
  return state.adminDepartments.some((department) => {
    const currentId = String(department.id ?? "").trim().toLowerCase();
    return currentId === normalizedId && currentId !== ignoredId;
  });
}

function captureDetailPanelScroll() {
  const panel = app?.querySelector(".detail-panel");
  if (!panel) return;
  state.detailPanelScrollTop = panel.scrollTop;
}

function restoreDetailPanelScroll() {
  const panel = app?.querySelector(".detail-panel");
  if (!panel) return;
  if (!Number.isFinite(state.detailPanelScrollTop)) return;
  panel.scrollTop = state.detailPanelScrollTop;
}

function captureDetailFormFocusState() {
  const active = document.activeElement;
  if (!active) return null;
  const id = String(active.id ?? "").trim();
  if (!id || !DETAIL_EDITABLE_IDS.has(id)) return null;
  const canTrackSelection =
    (active.tagName === "INPUT" || active.tagName === "TEXTAREA") &&
    typeof active.selectionStart === "number" &&
    typeof active.selectionEnd === "number";
  return {
    id,
    selectionStart: canTrackSelection ? active.selectionStart : null,
    selectionEnd: canTrackSelection ? active.selectionEnd : null,
  };
}

function restoreDetailFormFocusState(focusState) {
  if (!focusState || state.confirmDialog?.open) return;
  const target = document.querySelector(`#${focusState.id}`);
  if (!target || typeof target.focus !== "function") return;
  target.focus({ preventScroll: true });
  if (
    typeof focusState.selectionStart === "number" &&
    typeof focusState.selectionEnd === "number" &&
    typeof target.setSelectionRange === "function"
  ) {
    target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
  }
}

function errorContextLabel(contextLabel) {
  if (contextLabel === "__close_no_follow_up__") {
    return "Close No Follow-up";
  }
  return contextLabel;
}

function clearAuthBlockedState() {
  if (!state.authBlocked && !state.authMessage) return;
  state.authBlocked = false;
  state.authMessage = "";
}

function getFriendlyAuthMessage(rawMessage) {
  const message = String(rawMessage ?? "").trim();
  if (!message) return "Your previous session expired. Sign in again to continue.";
  const lower = message.toLowerCase();

  if (
    lower === "unauthorized" ||
    lower.includes("invalid auth token") ||
    lower.includes("auth required") ||
    lower.includes("token expired") ||
    lower.includes("expired")
  ) {
    return "Your previous session expired. Sign in again to continue.";
  }

  return message;
}

async function completeAuthenticatedStartup() {
  state.isAuthenticated = true;
  clearAuthBlockedState();
  state.accessDenied = false;
  state.authError = "";
  try {
    await refreshStoredFirebaseToken(true);
  } catch {
    // Non-fatal: continue with current token and allow request layer fallback behavior.
  }
  await refreshUserRole();
  if (!state.userRole) {
    setTimeout(async () => {
      if (!state.isAuthenticated || state.userRole) return;
      const hadRole = Boolean(state.userRole);
      await refreshUserRole();
      if (!hadRole && state.userRole) {
        render();
      }
    }, 1000);
  }
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
    clearAuthBlockedState();
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
  if (typeof confirmDialogResolver === "function") {
    confirmDialogResolver(false);
    confirmDialogResolver = null;
  }
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
  state.confirmDialog = {
    open: false,
    title: "",
    lines: [],
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    confirmTone: "primary",
  };
  state.sessions = [];
  state.selectedSession = null;
  state.messages = [];
  state.intakePanelStateBySession = {};
  state.closeRequirementsBySession = {};
  state.noFollowUpDisabledScopes = {};
  state.knownSessionIds = new Set();
  state.adminPanelOpen = false;
  state.adminUsers = [];
  state.adminDepartments = [];
  state.adminError = "";
  state.adminDialog = {
    open: false,
    type: "",
    mode: "create",
    id: "",
    name: "",
    email: "",
    phone: "",
    role: "support_agent",
    departments: "",
    allowedProducts: "",
    allowedTenantIds: "",
    active: true,
    label: "",
    product: "",
    defaultAssigneeIds: "",
  };
  state.assignmentOptions = {
    users: [],
    departments: [],
    loading: false,
    error: "",
  };
  state.assignDialog = {
    open: false,
    departmentId: "",
    assignedToUserId: "",
    note: "",
    notifyAssignee: true,
    includeTranscriptSummary: true,
  };
  state.transcriptDialog = {
    open: false,
    to: "",
    subject: "Your conversation transcript",
    includeAiMessages: true,
    includeAgentMessages: true,
    includeSystemMessages: false,
  };
  state.accessDenied = false;
  state.userRole = "";
  localStorage.removeItem(USER_ROLE_STORAGE_KEY);
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
            ? `<div class="banner banner-info">${escapeHtml(state.authMessage)}</div>`
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
                  <input id="auth-email-input" type="email" autocomplete="username" value="${escapeHtml(state.authEmail)}" placeholder="you@workside.ai" />
                </label>
                <label>
                  Password
                  <div class="password-input-wrap">
                    <input id="auth-password-input" type="${state.authPasswordVisible ? "text" : "password"}" autocomplete="current-password" value="${escapeHtml(state.authPassword)}" placeholder="Password" />
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
  const context = errorContextLabel(contextLabel);
  const parsed = parseChatApiError(error);
  const message = parsed.code ? `[${parsed.code}] ${parsed.message}` : parsed.message;

  if (isAuthErrorCode(parsed.code) || parsed.requiredAction === "login") {
    state.authBlocked = true;
    state.authMessage = getFriendlyAuthMessage(parsed.message);
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

  const isNoFollowUpContext = contextLabel === "__close_no_follow_up__";
  if (isNoFollowUpContext && parsed.code === "ANONYMOUS_CLOSE_NOT_ALLOWED") {
    disableNoFollowUpForCurrentScope();
    setBanner(
      "info",
      "Close No Follow-up is not available for this customer. Save the required information before closing, or ask an admin to enable anonymous no-follow-up closure.",
    );
    return;
  }

  if (parsed.requiredAction === "contact_admin") {
    try {
      await refreshStoredFirebaseToken(true);
      await refreshUserRole();
    } catch {
      // Best-effort role/token sync for recently changed claims.
    }
    setBanner(
      "warning",
      parsed.code
        ? `[${context}] [${parsed.code}] ${parsed.message || "Contact an administrator for this action."} If your role changed recently, sign out and sign back in.`
        : (`[${context}] ${parsed.message || "Your account is missing required permissions for this action. Contact an administrator."}`),
    );
    render();
    return;
  }

  if (parsed.requiredAction === "collect_lead" || parsed.code === "LEAD_CAPTURE_REQUIRED") {
    if (state.selectedSessionId) {
      markSessionCloseRequirement(state.selectedSessionId, "leadRequired", true);
      setIntakePanelOpenState(state.selectedSessionId, "leadOpen", true);
    }
    const firstMissing = parsed.missingFields?.[0];
    if (firstMissing === "email") {
      focusElement("#lead-email-input");
    } else if (firstMissing === "phone") {
      focusElement("#lead-phone-input");
    } else {
      focusElement("#lead-name-input");
    }
    setBanner("warning", `${context}: save the required lead information before continuing.`);
    return;
  }

  if (parsed.requiredAction === "collect_name") {
    focusElement("#lead-name-input");
    setBanner("warning", `${context}: save the contact name before continuing.`);
    return;
  }

  if (parsed.requiredAction === "collect_email") {
    focusElement("#lead-email-input");
    setBanner("warning", `${context}: save the contact email before continuing.`);
    return;
  }

  if (parsed.code === "CONTACT_EMAIL_REQUIRED") {
    if (state.selectedSessionId) {
      setIntakePanelOpenState(state.selectedSessionId, "leadOpen", true);
    }
    focusElement("#lead-email-input");
    setBanner("warning", "Save the contact email before sending a transcript.");
    return;
  }

  if (parsed.code === "TRANSCRIPT_EMPTY") {
    setBanner("warning", "There are no customer-visible messages to send yet.");
    return;
  }

  if (parsed.requiredAction === "collect_phone") {
    focusElement("#lead-phone-input");
    setBanner("warning", `${context}: save the contact phone before continuing.`);
    return;
  }

  if (parsed.requiredAction === "collect_inquiry" || parsed.code === "INQUIRY_CAPTURE_REQUIRED") {
    if (state.selectedSessionId) {
      markSessionCloseRequirement(state.selectedSessionId, "inquiryRequired", true);
      setIntakePanelOpenState(state.selectedSessionId, "inquiryOpen", true);
    }
    focusElement("#inquiry-summary-input");
    setBanner("warning", `${context}: save Inquiry Intake before this action can continue.`);
    return;
  }

  if (shouldRefreshSession(parsed.requiredAction, parsed.code)) {
    await loadSelectedSession({ silent: true });
    setBanner("error", message || `${context} failed. Session was refreshed.`);
    return;
  }

  setBanner("error", `${context} failed: ${message}`);
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

function formatPhoneInput(value) {
  const raw = String(value ?? "");
  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) return "";

  const hasCountryCode = digitsOnly.length > 10 && digitsOnly.startsWith("1");
  const localDigits = hasCountryCode ? digitsOnly.slice(1, 11) : digitsOnly.slice(0, 10);

  const area = localDigits.slice(0, 3);
  const exchange = localDigits.slice(3, 6);
  const line = localDigits.slice(6, 10);

  let formattedLocal = "";
  if (localDigits.length <= 3) {
    formattedLocal = area;
  } else if (localDigits.length <= 6) {
    formattedLocal = `(${area}) ${exchange}`;
  } else {
    formattedLocal = `(${area}) ${exchange}-${line}`;
  }

  return hasCountryCode ? `+1 ${formattedLocal}` : formattedLocal;
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

function hasRequiredLeadIdentity(session) {
  const name = String(session?.leadName ?? "").trim();
  const email = String(session?.leadEmail ?? "").trim();
  return Boolean(name && email);
}

function canCloseSession(session) {
  if (!session) return { ok: false, reason: "No session selected." };
  const enforcedCloseRequirements = sessionCloseRequirements(session.id);
  if (!hasRequiredLeadIdentity(session)) {
    return {
      ok: false,
      reason: "Save lead name and email before closing this session.",
    };
  }
  if ((session.requiresInquiryCapture || enforcedCloseRequirements.inquiryRequired) && !session.inquiryCaptured) {
    return {
      ok: false,
      reason: "Save inquiry intake before closing this session.",
    };
  }
  return { ok: true };
}

function getActionReadiness(session, actionLabel = "this action") {
  if (!session) return { ok: false, reason: "No session selected." };
  const enforcedCloseRequirements = sessionCloseRequirements(session.id);
  const inquiryRequired = Boolean(session.requiresInquiryCapture || enforcedCloseRequirements.inquiryRequired);

  if (!hasRequiredLeadIdentity(session)) {
    return {
      ok: false,
      reason: `Save lead name and email before ${actionLabel}.`,
      focusSelector: "#lead-name-input",
    };
  }

  if (inquiryRequired && !session.inquiryCaptured) {
    return {
      ok: false,
      reason: `Save Inquiry Intake before ${actionLabel}.`,
      focusSelector: "#inquiry-summary-input",
    };
  }

  return { ok: true, reason: "" };
}

function buildCloseSessionAttempts(session) {
  return [
    {
      sessionId: state.selectedSessionId,
      tenantId: session?.tenantId || undefined,
      product: session?.productKey || undefined,
      reason: "closed_by_support",
      resolutionNote: "Closed by support console",
      confirmNoFollowUp: false,
    },
    {
      sessionId: state.selectedSessionId,
      tenantId: session?.tenantId || undefined,
      product: session?.productKey || undefined,
      reason: "manual",
      resolutionNote: "Closed by support console",
      confirmNoFollowUp: false,
    },
    {
      sessionId: state.selectedSessionId,
      resolutionNote: "Closed by support console",
      confirmNoFollowUp: false,
    },
  ];
}

async function closeSessionWithFallbacks(session) {
  let detail = null;
  let lastError = null;

  for (const attempt of buildCloseSessionAttempts(session)) {
    try {
      detail = await closeSupportSession(attempt);
      if (detail?.session) return detail;
    } catch (attemptError) {
      lastError = attemptError;
      const parsedAttemptError = parseChatApiError(attemptError);
      const retryableCloseError =
        parsedAttemptError.status === 403 ||
        parsedAttemptError.code === "ANONYMOUS_CLOSE_NOT_ALLOWED" ||
        parsedAttemptError.requiredAction === "contact_admin";
      if (!retryableCloseError) {
        throw attemptError;
      }
    }
  }

  throw lastError ?? new Error("Close session request failed.");
}

function isInquiryCaptureRequiredError(error) {
  const parsed = parseChatApiError(error);
  return parsed.requiredAction === "collect_inquiry" || parsed.code === "INQUIRY_CAPTURE_REQUIRED";
}

async function saveDraftInquiryForSelectedSession() {
  const summary = state.inquiryDraft.messageSummary.trim();
  if (!summary || !state.selectedSessionId) return null;

  const detail = await saveInquiryForSession({
    sessionId: state.selectedSessionId,
    messageSummary: summary,
    urgency: state.inquiryDraft.urgency,
    intent: state.inquiryDraft.intent,
  });

  state.inquiryDirty = false;
  applySessionDetail(detail, { forceDraftSync: true });
  return detail?.session ?? null;
}

function upsertSession(nextSession) {
  if (!nextSession?.id) return;
  syncNoFollowUpScopeCapability(nextSession);
  syncSessionCloseRequirements(nextSession);
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
      phone: formatPhoneInput(session.leadPhone ?? ""),
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
      state.leadDraft.phone = formatPhoneInput(inferred.phone);
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

async function loadAdminPanelData() {
  if (!isSuperAdminRole()) return;
  state.adminLoading = true;
  state.adminError = "";
  render();
  try {
    const [users, departments] = await Promise.all([
      listSupportUsers({ admin: true }),
      listSupportDepartments({ admin: true }),
    ]);
    state.adminUsers = users;
    state.adminDepartments = departments;
  } catch (error) {
    const parsed = parseChatApiError(error);
    state.adminError = parsed.message || "Unable to load support admin data.";
  } finally {
    state.adminLoading = false;
    render();
  }
}

function resetAdminDialog() {
  state.adminDialog = {
    open: false,
    type: "",
    mode: "create",
    id: "",
    name: "",
    email: "",
    phone: "",
    role: "support_agent",
    departments: "",
    allowedProducts: "",
    allowedTenantIds: "",
    active: true,
    label: "",
    product: "",
    defaultAssigneeIds: "",
  };
}

function openAdminUserDialog(user = null) {
  if (!user && activeAdminDepartments().length === 0) {
    setBanner("warning", "Create at least one department before adding support users.");
    return;
  }
  state.adminDialog = {
    open: true,
    type: "user",
    mode: user ? "edit" : "create",
    id: user?.id ?? "",
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    role: user?.role ?? "support_agent",
    departments: listToCsv(user?.departments),
    allowedProducts: listToCsv(user?.allowedProducts) || state.supportFilters.product,
    allowedTenantIds: listToCsv(user?.allowedTenantIds),
    active: user?.active !== false,
    label: "",
    product: "",
    defaultAssigneeIds: "",
  };
  render();
}

function openAdminDepartmentDialog(department = null) {
  const defaultProduct = state.supportFilters.product || state.productOptions[0]?.id || FALLBACK_PRODUCTS[0]?.id || "";
  state.adminDialog = {
    open: true,
    type: "department",
    mode: department ? "edit" : "create",
    id: department?.id ?? "",
    name: "",
    email: "",
    phone: "",
    role: "support_agent",
    departments: "",
    allowedProducts: "",
    allowedTenantIds: "",
    active: department?.active !== false,
    label: department?.label ?? "",
    product: department?.product ?? defaultProduct,
    defaultAssigneeIds: listToCsv(department?.defaultAssigneeIds),
  };
  render();
}

function closeAdminDialog() {
  resetAdminDialog();
  render();
}

async function handleSaveAdminDialog() {
  if (!isSuperAdminRole() || state.busyAction) return;
  const dialog = state.adminDialog;
  if (!dialog.open) return;

  if (dialog.type === "user" && (!dialog.name.trim() || !dialog.email.trim())) {
    setBanner("warning", "Support user name and email are required.");
    return;
  }
  if (dialog.type === "user" && csvToList(dialog.departments).length === 0) {
    setBanner("warning", "Choose at least one department before saving a support user.");
    return;
  }
  if (dialog.type === "department" && (!dialog.id.trim() || !dialog.label.trim())) {
    setBanner("warning", "Department id and label are required.");
    return;
  }
  if (
    dialog.type === "department" &&
    dialog.mode === "create" &&
    departmentExists(dialog.id)
  ) {
    setBanner("warning", "A department with this id already exists.");
    return;
  }

  state.busyAction = true;
  render();
  try {
    if (dialog.type === "user") {
      const body = {
        name: dialog.name.trim(),
        email: dialog.email.trim(),
        phone: dialog.phone.trim(),
        role: dialog.role.trim() || "support_agent",
        departments: csvToList(dialog.departments),
        allowedProducts: csvToList(dialog.allowedProducts),
        allowedTenantIds: csvToList(dialog.allowedTenantIds),
        active: dialog.active,
      };
      if (dialog.mode === "edit") {
        await updateSupportUser(dialog.id, body);
      } else {
        await createSupportUser(body);
      }
      setBanner("success", dialog.mode === "edit" ? "Support user updated." : "Support user created.");
    }

    if (dialog.type === "department") {
      const body = {
        id: dialog.id.trim(),
        label: dialog.label.trim(),
        product: dialog.product.trim(),
        defaultAssigneeIds: csvToList(dialog.defaultAssigneeIds),
        active: dialog.active,
      };
      if (dialog.mode === "edit") {
        await updateSupportDepartment(dialog.id, body);
      } else {
        await createSupportDepartment(body);
      }
      setBanner("success", dialog.mode === "edit" ? "Department updated." : "Department created.");
    }

    resetAdminDialog();
    await loadAdminPanelData();
  } catch (error) {
    await handleChatApiError(dialog.type === "department" ? "Save department" : "Save support user", error);
  } finally {
    state.busyAction = false;
    render();
  }
}

async function handleDeleteDepartment(departmentId) {
  if (!isSuperAdminRole() || state.busyAction) return;
  const department = state.adminDepartments.find((item) => item.id === departmentId);
  if (!department) return;
  const confirmed = await requestConfirmationDialog({
    title: "Delete Department?",
    lines: [
      `Delete ${department.label || department.id}?`,
      "This should only be used for departments that are not currently assigned to active support users or sessions.",
    ],
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    confirmTone: "warning",
  });
  if (!confirmed) return;

  state.busyAction = true;
  render();
  try {
    await deleteSupportDepartment(department.id);
    setBanner("success", "Department deleted.");
    await loadAdminPanelData();
  } catch (error) {
    await handleChatApiError("Delete department", error);
  } finally {
    state.busyAction = false;
    render();
  }
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
    const previousSessionIds = state.knownSessionIds;
    const nextSessionIds = new Set(sessions.map((session) => session.id).filter(Boolean));
    const newSessionCount = [...nextSessionIds].filter((id) => !previousSessionIds.has(id)).length;
    state.sessions = sortSessionsByPriority(sessions);
    const shouldRevealSelectedSession = Boolean(state.selectedSessionId);
    for (const session of state.sessions) {
      syncNoFollowUpScopeCapability(session);
      syncSessionCloseRequirements(session);
    }
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
    if (silent && previousSessionIds.size > 0 && newSessionCount > 0) {
      playNewSessionSound();
      setBanner(
        "success",
        `${newSessionCount} new session ${newSessionCount === 1 ? "arrived" : "arrived"}.`,
      );
    }
    state.knownSessionIds = nextSessionIds;
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
    if (shouldRevealSelectedSession) {
      setTimeout(() => {
        scrollSelectedSessionIntoView();
      }, 0);
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
  state.selectedSession = null;
  state.messages = [];
  state.replyDraft = "";
  state.leadDirty = false;
  state.inquiryDirty = false;
  state.transferDirty = false;
  state.assignDialog.open = false;
  state.transcriptDialog.open = false;
  state.detailPanelScrollTop = 0;
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
  const activeSession = getSelectedSessionContext();
  const transferReadiness = getActionReadiness(activeSession, "requesting transfer");
  if (!transferReadiness.ok) {
    if (activeSession?.id) {
      if (transferReadiness.focusSelector === "#lead-name-input") {
        setIntakePanelOpenState(activeSession.id, "leadOpen", true);
      }
      if (transferReadiness.focusSelector === "#inquiry-summary-input") {
        setIntakePanelOpenState(activeSession.id, "inquiryOpen", true);
      }
    }
    setBanner("warning", transferReadiness.reason);
    focusElement(transferReadiness.focusSelector);
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
    const sentAt = new Date().toISOString();
    const detail = await sendAgentReply({
      sessionId: state.selectedSessionId,
      message: text,
      agentName: state.agentName.trim(),
    });

    clearAuthBlockedState();
    state.replyDraft = "";
    applySessionDetail(detail);
    if (!state.messages.some((message) => message.sender === "agent" && message.body === text)) {
      state.messages = [
        ...state.messages,
        {
          id: `local-reply-${crypto.randomUUID()}`,
          sessionId: state.selectedSessionId,
          tenantId: state.selectedSession?.tenantId,
          sender: "agent",
          body: text,
          createdAt: sentAt,
        },
      ];
    }
    setBanner("success", "Reply sent.");
  } catch (error) {
    await handleChatApiError("Send reply", error);
  } finally {
    state.busyAction = false;
    render();
  }
}

async function loadAssignmentOptions(session) {
  if (!session) return;
  state.assignmentOptions = {
    ...state.assignmentOptions,
    loading: true,
    error: "",
  };
  render();
  try {
    const [departments, users] = await Promise.all([
      listSupportDepartments({
        product: session.productKey || undefined,
      }),
      listSupportUsers({
        product: session.productKey || undefined,
        tenantId: session.tenantId || undefined,
        departmentId: state.assignDialog.departmentId || undefined,
      }),
    ]);
    state.assignmentOptions = {
      users,
      departments,
      loading: false,
      error: "",
    };
    if (!state.assignDialog.departmentId && departments[0]?.id) {
      state.assignDialog.departmentId = departments[0].id;
    }
    if (
      !state.assignDialog.assignedToUserId &&
      session.assignedToUserId &&
      users.some((user) => user.id === session.assignedToUserId)
    ) {
      state.assignDialog.assignedToUserId = session.assignedToUserId;
    } else if (!state.assignDialog.assignedToUserId && users[0]?.id) {
      state.assignDialog.assignedToUserId = users[0].id;
    }
  } catch (error) {
    const parsed = parseChatApiError(error);
    state.assignmentOptions = {
      users: [],
      departments: [],
      loading: false,
      error: parsed.message || "Unable to load assignment options.",
    };
  } finally {
    render();
  }
}

async function handleOpenAssignDialog() {
  const session = getSelectedSessionContext();
  if (!session || state.busyAction) return;
  if (isViewerRole()) {
    setBanner("warning", "Viewer role is read-only.");
    return;
  }
  state.assignDialog = {
    open: true,
    departmentId: session.departmentId || "",
    assignedToUserId: "",
    note: "",
    notifyAssignee: true,
    includeTranscriptSummary: true,
  };
  render();
  await loadAssignmentOptions(session);
}

function handleCloseAssignDialog() {
  state.assignDialog.open = false;
  render();
}

function handleOpenTranscriptDialog() {
  const session = getSelectedSessionContext();
  if (!session || state.busyAction) return;
  if (isViewerRole()) {
    setBanner("warning", "Viewer role is read-only.");
    return;
  }
  if (!session.leadEmail) {
    setIntakePanelOpenState(session.id, "leadOpen", true);
    setBanner("warning", "Save the contact email before sending a transcript.");
    focusElement("#lead-email-input");
    return;
  }
  if (!hasSendableTranscriptMessages(session)) {
    setBanner("warning", "There are no customer-visible messages to send yet.");
    return;
  }

  state.transcriptDialog = {
    open: true,
    to: session.leadEmail,
    subject: "Your conversation transcript",
    includeAiMessages: true,
    includeAgentMessages: true,
    includeSystemMessages: false,
  };
  render();
}

function handleCloseTranscriptDialog() {
  state.transcriptDialog.open = false;
  render();
}

async function handleAssignSession() {
  const session = getSelectedSessionContext();
  if (!session || state.busyAction) return;
  if (!state.assignDialog.assignedToUserId) {
    state.assignmentOptions.error = "Choose a support user before assigning this session.";
    render();
    return;
  }

  state.busyAction = true;
  state.assignmentOptions.error = "";
  render();
  try {
    const detail = await assignSupportSession({
      sessionId: state.selectedSessionId,
      tenantId: session.tenantId || undefined,
      product: session.productKey || undefined,
      departmentId: state.assignDialog.departmentId || undefined,
      assignedToUserId: state.assignDialog.assignedToUserId,
      note: state.assignDialog.note.trim(),
      notifyAssignee: state.assignDialog.notifyAssignee,
      includeTranscriptSummary: state.assignDialog.includeTranscriptSummary,
    });
    applySessionDetail(detail);
    state.assignDialog.open = false;
    await loadSessions({ silent: true });
    setBanner("success", "Session assigned.");
  } catch (error) {
    const parsed = parseChatApiError(error);
    const assignmentCodes = new Set([
      "ASSIGNEE_REQUIRED",
      "ASSIGNEE_NOT_FOUND",
      "ASSIGNEE_INACTIVE",
      "ASSIGNEE_ACCESS_DENIED",
      "DEPARTMENT_NOT_FOUND",
      "DEPARTMENT_INACTIVE",
      "ASSIGNMENT_VALIDATION_ERROR",
    ]);
    if (assignmentCodes.has(parsed.code) || parsed.requiredAction === "choose_assignee") {
      state.assignmentOptions.error =
        parsed.message || "Choose another support user or department before assigning this session.";
    } else {
      await handleChatApiError("Assign session", error);
    }
  } finally {
    state.busyAction = false;
    render();
  }
}

async function handleSendTranscript() {
  const session = getSelectedSessionContext();
  if (!session || state.busyAction) return;
  const to = state.transcriptDialog.to.trim();
  const subject = state.transcriptDialog.subject.trim();
  if (!to) {
    setBanner("warning", "Enter the contact email before sending a transcript.");
    focusElement("#transcript-to-input");
    return;
  }

  state.busyAction = true;
  render();
  try {
    const detail = await sendTranscriptForSession({
      sessionId: state.selectedSessionId,
      tenantId: session.tenantId || undefined,
      product: session.productKey || undefined,
      to,
      subject: subject || undefined,
      includeAiMessages: state.transcriptDialog.includeAiMessages,
      includeAgentMessages: state.transcriptDialog.includeAgentMessages,
      includeSystemMessages: state.transcriptDialog.includeSystemMessages,
    });
    applySessionDetail(detail);
    state.transcriptDialog.open = false;
    setBanner("success", `Transcript sent to ${to}.`);
  } catch (error) {
    await handleChatApiError("Send transcript", error);
  } finally {
    state.busyAction = false;
    render();
  }
}

async function handleSaveLead() {
  const sessionId = state.selectedSessionId;
  if (!sessionId || state.busyAction) return;
  if (isViewerRole()) {
    setBanner("warning", "Viewer role is read-only.");
    return;
  }

  const name = state.leadDraft.name.trim();
  const email = state.leadDraft.email.trim();
  const phone = state.leadDraft.phone.trim();
  const company = state.leadDraft.company.trim();

  if (!name || !email) {
    setBanner("error", "Name and email are required to satisfy lead capture enforcement.");
    return;
  }

  state.busyAction = true;
  render();
  try {
    const detail = await saveLeadForSession({
      sessionId,
      name,
      email,
      phone,
      company,
    });

    clearAuthBlockedState();
    state.leadDirty = false;
    applySessionDetail(detail, { forceDraftSync: true });
    setBanner("success", "Lead details saved.");
    await loadSessions({ silent: true });
    scrollSelectedSessionIntoView({ force: true });
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
    await loadSessions({ silent: true });
    scrollSelectedSessionIntoView({ force: true });
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
  const activeSession = getSelectedSessionContext();
  if (!activeSession || state.busyAction) return;
  if (isViewerRole()) {
    setBanner("warning", "Viewer role is read-only.");
    return;
  }

  const closeCheck = canCloseSession(activeSession);
  if (!closeCheck.ok) {
    setBanner("error", closeCheck.reason);
    return;
  }

  const confirmed = await requestConfirmationDialog({
    title: "Close Session?",
    lines: [
      "This will move the session to Closed.",
      "You can still review history afterward, but the conversation will be treated as resolved.",
    ],
    confirmLabel: "Close Session",
    cancelLabel: "Cancel",
    confirmTone: "warning",
  });
  if (!confirmed) return;

  state.busyAction = true;
  render();
  try {
    let detail = null;
    try {
      detail = await closeSessionWithFallbacks(activeSession);
    } catch (closeError) {
      if (!isInquiryCaptureRequiredError(closeError) || !state.inquiryDraft.messageSummary.trim()) {
        throw closeError;
      }

      const updatedSession = await saveDraftInquiryForSelectedSession();
      detail = await closeSessionWithFallbacks(updatedSession ?? getSelectedSessionContext() ?? activeSession);
    }

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
  const activeSession = getSelectedSessionContext();
  if (!activeSession || state.busyAction) return;
  if (isViewerRole()) {
    setBanner("warning", "Viewer role is read-only.");
    return;
  }
  if (activeSession.status === "closed") {
    setBanner("warning", "This session is already closed.");
    return;
  }
  if (isNoFollowUpDisabledForSession(activeSession)) {
    setBanner(
      "warning",
      "Close No Follow-up is not enabled for this tenant. Ask an admin to enable allowAnonymousNoFollowUpClose.",
    );
    return;
  }

  const confirmed = await requestConfirmationDialog({
    title: "Close As No Follow-up?",
    lines: [
      "This will close the session as an anonymous no-follow-up outcome.",
      "The record will be preserved for audit/reporting.",
      "If lead/inquiry data is required, minimal placeholders will be saved automatically first.",
    ],
    confirmLabel: "Close Session",
    cancelLabel: "Cancel",
    confirmTone: "warning",
  });
  if (!confirmed) return;

  state.busyAction = true;
  render();

  try {
    let currentSession = activeSession;

    if (!hasRequiredLeadIdentity(currentSession)) {
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
      tenantId: currentSession?.tenantId || undefined,
      product: currentSession?.productKey || undefined,
      reason: "anonymous_no_follow_up",
      resolutionNote: "No follow-up required",
      confirmNoFollowUp: true,
    });

    clearAuthBlockedState();
    applySessionDetail(detail);
    setBanner("success", "Session closed as No Follow-up.");
  } catch (error) {
    await handleChatApiError("__close_no_follow_up__", error);
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
      const leadState = hasRequiredLeadIdentity(session) ? "Lead captured" : "Lead missing";
      const tenantLabel = session.tenantName || session.organizationName || session.tenantId || "Unknown tenant";
      const compactTenantLabel = abbreviateMiddle(tenantLabel, { max: 28, keep: 8 });
      const assignedTo = session.assignedToName || session.assignedToEmail || session.assignedToUserId || "Unassigned";
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

function renderSessionOperationsSummary(session) {
  const latestAssignment = session.latestAssignment;
  const assignmentLabel = latestAssignment
    ? latestAssignment.assignedToName ||
      latestAssignment.assignedToEmail ||
      latestAssignment.assignedToUserId ||
      "Assigned"
    : session.assignedToName || session.assignedToEmail || session.assignedToUserId || "Unassigned";
  const assignmentMeta = latestAssignment?.assignedAt
    ? `Updated ${formatTimestamp(latestAssignment.assignedAt)}`
    : session.departmentLabel
      ? "Current routing"
      : "No assignment history";
  const transcriptLabel = session.lastTranscriptSentAt
    ? `Sent ${formatTimestamp(session.lastTranscriptSentAt)}`
    : "Not sent";
  const transcriptMeta = session.lastTranscriptSentTo
    ? `To ${session.lastTranscriptSentTo}`
    : "No transcript email recorded";

  return `
    <section class="operations-summary" aria-label="Assignment and transcript status">
      <article>
        <span>Assignment</span>
        <strong>${escapeHtml(assignmentLabel)}</strong>
        <p>${escapeHtml(assignmentMeta)}</p>
      </article>
      <article>
        <span>Department</span>
        <strong>${escapeHtml(latestAssignment?.departmentLabel || session.departmentLabel || "Unassigned")}</strong>
        <p>${escapeHtml(latestAssignment?.note || "No assignment note")}</p>
      </article>
      <article>
        <span>Transcript</span>
        <strong>${escapeHtml(transcriptLabel)}</strong>
        <p>${escapeHtml(transcriptMeta)}</p>
      </article>
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

  if (state.loadingSession && (!state.selectedSession || state.selectedSession.id !== state.selectedSessionId)) {
    return `
      <section class="detail-loading" aria-live="polite" aria-busy="true">
        <div class="loading-spinner" aria-hidden="true"></div>
        <h2>Loading session</h2>
        <p>Fetching the selected conversation, lead details, and intake status.</p>
      </section>
    `;
  }

  const session =
    state.selectedSession?.id === state.selectedSessionId
      ? state.selectedSession
      : state.sessions.find((item) => item.id === state.selectedSessionId);
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
  const transferReadiness = getActionReadiness(session, "requesting transfer");
  const requestTransferButtonEnabled = canRequestTransfer && transferReadiness.ok && !state.busyAction;
  const canReply = !readOnly && session.status === "active_human";
  const canEditIntake = !readOnly;
  const transcriptHasMessages = hasSendableTranscriptMessages(session);
  const canSendTranscript = !readOnly && Boolean(session.leadEmail) && transcriptHasMessages && !state.busyAction;
  const transcriptTitle = !session.leadEmail
    ? "Save contact email before sending transcript"
    : !transcriptHasMessages
      ? "No customer-visible messages are available for transcript"
      : `Send transcript to ${session.leadEmail}`;
  const canAssignSession = !readOnly && session.status !== "closed" && !state.busyAction;
  const noFollowUpDisabled = isNoFollowUpDisabledForSession(session);
  const canCloseNoFollowUp = !readOnly && session.status !== "closed" && !noFollowUpDisabled;
  const leadIdentityCaptured = hasRequiredLeadIdentity(session);
  const tenantLabel = session.tenantName || session.organizationName || session.tenantId || "Unknown";
  const tenantIdTooltip = session.tenantId
    ? `Tenant ID: ${session.tenantId}`
    : "Tenant ID is not available for this session.";
  const leadNeedsAttention = !leadIdentityCaptured || state.leadDirty;
  const inquiryNeedsAttention =
    (session.requiresInquiryCapture && !session.inquiryCaptured) || state.inquiryDirty;
  const panelState = sessionIntakePanelState(session.id);
  const leadPanelOpen = typeof panelState.leadOpen === "boolean" ? panelState.leadOpen : leadNeedsAttention;
  const inquiryPanelOpen =
    typeof panelState.inquiryOpen === "boolean" ? panelState.inquiryOpen : inquiryNeedsAttention;
  const enforcedCloseRequirements = sessionCloseRequirements(session.id);
  const leadDraftReady = Boolean(state.leadDraft.name.trim() && state.leadDraft.email.trim());
  const inquiryDraftReady = Boolean(state.inquiryDraft.messageSummary.trim());
  const inquiryRequiredForClose = Boolean(session.requiresInquiryCapture || enforcedCloseRequirements.inquiryRequired);
  const leadReadyForCloseUi = leadIdentityCaptured;
  const inquiryReadyForCloseUi = Boolean(!inquiryRequiredForClose || session.inquiryCaptured);
  const needsLeadSaveForClose = !leadIdentityCaptured && leadDraftReady;
  const needsInquirySaveForClose = inquiryRequiredForClose && !session.inquiryCaptured && inquiryDraftReady;
  const inquiryStateLabel = !inquiryRequiredForClose
    ? "Not required"
    : session.inquiryCaptured
      ? "Captured"
      : "Required";
  const closeButtonEnabled =
    !readOnly &&
    closeCheck.ok &&
    leadReadyForCloseUi &&
    inquiryReadyForCloseUi &&
    !state.busyAction;
  const closeActionHint = readOnly
    ? "Viewer role is read-only. You cannot close sessions."
    : needsLeadSaveForClose
      ? "Lead details are filled in. Click Save Lead to enable Close Session."
      : needsInquirySaveForClose
        ? "Inquiry details are filled in. Click Save Inquiry to enable Close Session."
        : !leadReadyForCloseUi
          ? "Complete Name and Email in Lead Capture to enable Close Session."
          : !inquiryReadyForCloseUi
            ? "Complete Inquiry Summary in Inquiry Intake to enable Close Session."
            : closeCheck.ok
              ? "To set status to Closed, click Close Session."
              : noFollowUpDisabled
                ? `${closeCheck.reason} Close No Follow-up is disabled for this tenant.`
                : `${closeCheck.reason} If no follow-up is needed, use Close No Follow-up.`;
  const closeNoFollowUpTitle = noFollowUpDisabled
    ? "Close No Follow-up is disabled for this tenant."
    : "Close anonymous/no-follow-up sessions with confirmation";
  const noFollowUpStatus = noFollowUpDisabled
    ? "Unavailable for this customer"
    : "Available when there is no actionable request";
  const normalCloseStatus = closeCheck.ok
    ? "Ready"
    : closeCheck.reason;
  const readinessItems = [
    {
      label: "Lead captured",
      complete: leadIdentityCaptured,
    },
    {
      label: "Inquiry captured",
      complete: !inquiryRequiredForClose || Boolean(session.inquiryCaptured),
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
          <p class="detail-session-time">Last activity: ${escapeHtml(formatTimestamp(session.updatedAt))} | Started: ${escapeHtml(formatTimestamp(session.createdAt))}</p>
          <p class="close-action-hint">${escapeHtml(closeActionHint)}</p>
        </div>
        <div class="detail-actions">
          <button id="takeover-button" class="button button-primary" ${canTakeOver && !state.busyAction ? "" : "disabled"}>
            Accept Transfer
          </button>
          <button
            id="assign-session-button"
            class="button"
            type="button"
            ${canAssignSession ? "" : "disabled"}
          >
            Assign
          </button>
          <button
            id="send-transcript-button"
            class="button"
            type="button"
            title="${escapeHtml(transcriptTitle)}"
            ${canSendTranscript ? "" : "disabled"}
          >
            Send Transcript
          </button>
          <button
            id="close-no-followup-button"
            class="button button-warning"
            title="${escapeHtml(closeNoFollowUpTitle)}"
            ${canCloseNoFollowUp && !state.busyAction ? "" : "disabled"}
          >
            ${noFollowUpDisabled ? "No Follow-up Disabled" : "Close No Follow-up"}
          </button>
          <button
            id="close-button"
            class="button button-quiet"
            title="${escapeHtml(closeActionHint)}"
            ${closeButtonEnabled ? "" : "disabled"}
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
        <div><dt>Lead</dt><dd>${leadIdentityCaptured ? "Captured" : "Missing"}</dd></div>
        <div><dt>Inquiry</dt><dd>${session.inquiryCaptured ? "Captured" : "Not captured"}</dd></div>
        <div><dt>Owner</dt><dd>${escapeHtml(session.assignedToName || session.assignedToEmail || session.assignedToUserId || state.agentName || "Unassigned")}</dd></div>
        <div><dt>Department</dt><dd>${escapeHtml(session.departmentLabel || "Unassigned")}</dd></div>
      </dl>

      ${renderSessionOperationsSummary(session)}

      <section class="closure-guide" aria-label="Closure options">
        <div class="closure-guide-item">
          <span>No details, no follow-up</span>
          <strong>Use Close No Follow-up</strong>
          <p>${escapeHtml(noFollowUpStatus)}.</p>
        </div>
        <div class="closure-guide-item">
          <span>Contact captured, no action needed</span>
          <strong>Save Lead, then close</strong>
          <p>Close Session becomes available after saved required lead fields are reflected on the session.</p>
        </div>
        <div class="closure-guide-item">
          <span>Contact plus request</span>
          <strong>Save Lead and Inquiry</strong>
          <p>${escapeHtml(normalCloseStatus)}</p>
        </div>
      </section>

      <section class="intake-accordion">
        <details id="lead-intake-panel" class="intake-panel" ${leadPanelOpen ? "open" : ""}>
          <summary>
            <span>Lead Capture</span>
            <strong>${leadIdentityCaptured ? "Captured" : "Required"}</strong>
          </summary>
          <form id="lead-form" class="intake-form">
            <p>Name + email required before close.</p>
            <div class="intake-form-grid-two">
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
                <input id="lead-phone-input" type="tel" inputmode="tel" autocomplete="tel" value="${escapeHtml(state.leadDraft.phone)}" placeholder="(555) 555-5555" ${canEditIntake ? "" : "disabled"} />
              </label>
              <label>
                Company
                <input id="lead-company-input" value="${escapeHtml(state.leadDraft.company)}" placeholder="Optional" ${canEditIntake ? "" : "disabled"} />
              </label>
            </div>
            <button class="button button-primary" type="submit" ${state.busyAction || !canEditIntake ? "disabled" : ""}>Save Lead</button>
          </form>
        </details>

        <details id="inquiry-intake-panel" class="intake-panel" ${inquiryPanelOpen ? "open" : ""}>
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
              <button
                id="request-transfer-button"
                class="button"
                type="submit"
                title="${escapeHtml(transferReadiness.ok ? "Request human transfer" : transferReadiness.reason)}"
                ${requestTransferButtonEnabled ? "" : "disabled"}
              >
                Request Transfer
              </button>
              ${
                transferReadiness.ok
                  ? ""
                  : `<p class="transfer-action-note">${escapeHtml(transferReadiness.reason)}</p>`
              }
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

function renderConfirmDialog() {
  if (!state.confirmDialog?.open) return "";
  const confirmToneClass =
    state.confirmDialog.confirmTone === "warning" ? "button button-warning" : "button button-primary";
  return `
    <div id="confirm-dialog-backdrop" class="confirm-overlay" role="presentation">
      <section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <header class="confirm-dialog-header">
          <h3 id="confirm-dialog-title">${escapeHtml(state.confirmDialog.title || "Please Confirm")}</h3>
        </header>
        <div class="confirm-dialog-body">
          ${(state.confirmDialog.lines ?? [])
            .map((line) => `<p>${escapeHtml(line)}</p>`)
            .join("")}
        </div>
        <footer class="confirm-dialog-actions">
          <button id="confirm-dialog-cancel" class="button button-quiet" type="button">${escapeHtml(
            state.confirmDialog.cancelLabel || "Cancel",
          )}</button>
          <button id="confirm-dialog-confirm" class="${confirmToneClass}" type="button">${escapeHtml(
            state.confirmDialog.confirmLabel || "Confirm",
          )}</button>
        </footer>
      </section>
    </div>
  `;
}

function renderAssignDialog() {
  if (!state.assignDialog.open) return "";
  const session = getSelectedSessionContext();
  const departments = state.assignmentOptions.departments;
  const users = state.assignmentOptions.users;
  const selectedDepartment = departments.find((department) => department.id === state.assignDialog.departmentId);
  const selectedUser = users.find((user) => user.id === state.assignDialog.assignedToUserId);
  const currentOwner =
    session?.assignedToName || session?.assignedToEmail || session?.assignedToUserId || "Unassigned";
  const eligibleUsers = users.filter((user) => user.active !== false);
  return `
    <div id="assign-dialog-backdrop" class="confirm-overlay" role="presentation">
      <section class="confirm-dialog assign-dialog" role="dialog" aria-modal="true" aria-labelledby="assign-dialog-title">
        <header class="confirm-dialog-header">
          <h3 id="assign-dialog-title">Assign Session</h3>
        </header>
        <form id="assign-session-form" class="assign-dialog-body">
          <div class="dialog-context-grid">
            <div class="dialog-context-item">
              <span>Current owner</span>
              <strong>${escapeHtml(currentOwner)}</strong>
            </div>
            <div class="dialog-context-item">
              <span>Routing</span>
              <strong>${escapeHtml(selectedDepartment?.label || session?.departmentLabel || "Choose department")}</strong>
            </div>
          </div>
          ${
            state.assignmentOptions.error
              ? `<div class="banner banner-warning">${escapeHtml(state.assignmentOptions.error)}</div>`
              : ""
          }
          <label>
            Department
            <select id="assign-department-input" ${state.assignmentOptions.loading ? "disabled" : ""}>
              <option value="">Select department</option>
              ${departments
                .map(
                  (department) => `<option value="${escapeHtml(department.id)}" ${
                    state.assignDialog.departmentId === department.id ? "selected" : ""
                  }>${escapeHtml(department.label)}</option>`,
                )
                .join("")}
            </select>
          </label>
          <label>
            Support user
            <select id="assign-user-input" ${state.assignmentOptions.loading ? "disabled" : ""}>
              <option value="">Select user</option>
              ${users
                .map(
                  (user) => `<option value="${escapeHtml(user.id)}" ${
                    state.assignDialog.assignedToUserId === user.id ? "selected" : ""
                  }>${escapeHtml(supportUserDisplayLabel(user))}${user.active ? "" : " (inactive)"}</option>`,
                )
                .join("")}
            </select>
          </label>
          ${
            !state.assignmentOptions.loading && !users.length
              ? `<p class="dialog-help">No support users are available for this product, tenant, or department yet.</p>`
              : ""
          }
          ${
            selectedUser
              ? `<p class="dialog-help">Assigning to <strong>${escapeHtml(selectedUser.name)}</strong>${
                  selectedUser.departments.length
                    ? ` in ${escapeHtml(selectedUser.departments.join(", "))}`
                    : ""
                }.</p>`
              : eligibleUsers.length
                ? `<p class="dialog-help">Choose one of ${eligibleUsers.length} active support users.</p>`
                : ""
          }
          <label>
            Note
            <textarea id="assign-note-input" rows="3" placeholder="Context for the assignee">${escapeHtml(
              state.assignDialog.note,
            )}</textarea>
          </label>
          <label class="checkbox-row">
            <input id="assign-notify-input" type="checkbox" ${state.assignDialog.notifyAssignee ? "checked" : ""} />
            Notify assignee
          </label>
          <label class="checkbox-row">
            <input id="assign-summary-input" type="checkbox" ${state.assignDialog.includeTranscriptSummary ? "checked" : ""} />
            Include transcript summary
          </label>
          <footer class="confirm-dialog-actions">
            <button id="assign-dialog-cancel" class="button button-quiet" type="button">Cancel</button>
            <button class="button button-primary" type="submit" ${
              state.busyAction || state.assignmentOptions.loading || !state.assignDialog.assignedToUserId ? "disabled" : ""
            }>Assign</button>
          </footer>
        </form>
      </section>
    </div>
  `;
}

function renderTranscriptDialog() {
  if (!state.transcriptDialog.open) return "";
  return `
    <div id="transcript-dialog-backdrop" class="confirm-overlay" role="presentation">
      <section class="confirm-dialog assign-dialog" role="dialog" aria-modal="true" aria-labelledby="transcript-dialog-title">
        <header class="confirm-dialog-header">
          <h3 id="transcript-dialog-title">Send Transcript</h3>
        </header>
        <form id="transcript-form" class="assign-dialog-body">
          <div class="dialog-context-grid">
            <div class="dialog-context-item">
              <span>Recipient</span>
              <strong>${escapeHtml(state.transcriptDialog.to || "Add email")}</strong>
            </div>
            <div class="dialog-context-item">
              <span>Safety</span>
              <strong>Customer-safe only</strong>
            </div>
          </div>
          <p class="dialog-help">
            The backend should exclude internal notes, diagnostics, audit entries, and private routing metadata.
          </p>
          <label>
            Contact email
            <input
              id="transcript-to-input"
              type="email"
              value="${escapeHtml(state.transcriptDialog.to)}"
              placeholder="contact@example.com"
            />
          </label>
          <label>
            Subject
            <input
              id="transcript-subject-input"
              type="text"
              value="${escapeHtml(state.transcriptDialog.subject)}"
              placeholder="Your conversation transcript"
            />
          </label>
          <label class="checkbox-row">
            <input id="transcript-ai-input" type="checkbox" ${state.transcriptDialog.includeAiMessages ? "checked" : ""} />
            Include AI messages
          </label>
          <label class="checkbox-row">
            <input id="transcript-agent-input" type="checkbox" ${state.transcriptDialog.includeAgentMessages ? "checked" : ""} />
            Include agent messages
          </label>
          <label class="checkbox-row">
            <input id="transcript-system-input" type="checkbox" ${state.transcriptDialog.includeSystemMessages ? "checked" : ""} />
            Include system-visible messages
          </label>
          <footer class="confirm-dialog-actions">
            <button id="transcript-dialog-cancel" class="button button-quiet" type="button">Cancel</button>
            <button class="button button-primary" type="submit" ${
              state.busyAction || !state.transcriptDialog.to.trim() ? "disabled" : ""
            }>Send Transcript</button>
          </footer>
        </form>
      </section>
    </div>
  `;
}

function renderAdminPanel() {
  if (!isSuperAdminRole() || !state.adminPanelOpen) return "";
  const activeUsers = state.adminUsers.filter((user) => user.active).length;
  const activeDepartments = state.adminDepartments.filter((department) => department.active).length;
  const uniqueRoles = new Set(state.adminUsers.map((user) => user.role).filter(Boolean)).size;
  const canCreateUsers = activeAdminDepartments().length > 0;
  return `
    <section class="admin-panel">
      <header class="admin-panel-header">
        <div>
          <h3>Support Admin</h3>
          <p>Manage support users, departments, and assignment routing for this console.</p>
        </div>
        <div class="admin-panel-actions">
          <button
            id="admin-user-create-button"
            class="button button-primary"
            type="button"
            title="${canCreateUsers ? "Add support user" : "Create a department before adding users"}"
            ${state.adminLoading || !canCreateUsers ? "disabled" : ""}
          >Add User</button>
          <button id="admin-department-create-button" class="button" type="button" ${state.adminLoading ? "disabled" : ""}>Add Department</button>
          <button id="admin-refresh-button" class="button" type="button" ${state.adminLoading ? "disabled" : ""}>Refresh</button>
        </div>
      </header>
      ${state.adminError ? `<div class="banner banner-warning">${escapeHtml(state.adminError)}</div>` : ""}
      ${
        !canCreateUsers
          ? `<div class="banner banner-info">Create at least one department before adding support users.</div>`
          : ""
      }
      <div class="admin-summary-grid">
        <article class="admin-summary-card">
          <span>Support users</span>
          <strong>${escapeHtml(String(state.adminUsers.length))}</strong>
          <p>${escapeHtml(String(activeUsers))} active</p>
        </article>
        <article class="admin-summary-card">
          <span>Departments</span>
          <strong>${escapeHtml(String(state.adminDepartments.length))}</strong>
          <p>${escapeHtml(String(activeDepartments))} active</p>
        </article>
        <article class="admin-summary-card">
          <span>Roles in use</span>
          <strong>${escapeHtml(String(uniqueRoles || 0))}</strong>
          <p>Current support staffing mix</p>
        </article>
      </div>
      <div class="admin-grid">
        <section>
          <h4>Support Users</h4>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Departments</th><th>Products</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                ${
                  state.adminUsers.length
                    ? state.adminUsers
                        .map(
                          (user) => `<tr>
                            <td>${escapeHtml(user.name)}</td>
                            <td>${escapeHtml(user.email || "-")}</td>
                            <td>${escapeHtml(user.phone || "-")}</td>
                            <td>${escapeHtml(user.role)}</td>
                            <td>${escapeHtml(user.departments.join(", ") || "-")}</td>
                            <td>${escapeHtml(user.allowedProducts.join(", ") || "-")}</td>
                            <td>${user.active ? "Active" : "Inactive"}</td>
                            <td><button class="button button-compact" type="button" data-admin-user-edit="${escapeHtml(user.id)}">Edit</button></td>
                          </tr>`,
                        )
                        .join("")
                    : `<tr><td colspan="8">No support users loaded.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h4>Departments</h4>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr><th>ID</th><th>Department</th><th>Product</th><th>Defaults</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                ${
                  state.adminDepartments.length
                    ? state.adminDepartments
                        .map(
                          (department) => `<tr>
                            <td><code>${escapeHtml(department.id)}</code></td>
                            <td>${escapeHtml(department.label)}</td>
                            <td>${escapeHtml(department.product || "-")}</td>
                            <td>${escapeHtml(department.defaultAssigneeIds.join(", ") || "-")}</td>
                            <td>${department.active ? "Active" : "Inactive"}</td>
                            <td class="admin-row-actions">
                              <button class="button button-compact" type="button" data-admin-department-edit="${escapeHtml(department.id)}">Edit</button>
                              <button class="button button-compact button-danger" type="button" data-admin-department-delete="${escapeHtml(department.id)}">Delete</button>
                            </td>
                          </tr>`,
                        )
                        .join("")
                    : `<tr><td colspan="6">No departments loaded.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderAdminDialog() {
  if (!state.adminDialog.open) return "";
  const dialog = state.adminDialog;
  const isUser = dialog.type === "user";
  const title = `${dialog.mode === "edit" ? "Edit" : "Add"} ${isUser ? "Support User" : "Department"}`;
  const products = state.productOptions.length ? state.productOptions : FALLBACK_PRODUCTS;
  const departmentOptions = activeAdminDepartments();
  const selectedDepartments = new Set(csvToList(dialog.departments));
  const duplicateDepartmentId = !isUser && dialog.mode === "create" && departmentExists(dialog.id);
  return `
    <div id="admin-dialog-backdrop" class="confirm-overlay" role="presentation">
      <section class="confirm-dialog admin-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title">
        <header class="confirm-dialog-header">
          <h3 id="admin-dialog-title">${escapeHtml(title)}</h3>
        </header>
        <form id="admin-dialog-form" class="assign-dialog-body">
          ${
            isUser
              ? `
                <label>
                  Name
                  <input id="admin-user-name-input" value="${escapeHtml(dialog.name)}" placeholder="Support user name" />
                </label>
                <label>
                  Email
                  <input id="admin-user-email-input" type="email" value="${escapeHtml(dialog.email)}" placeholder="user@example.com" />
                </label>
                <label>
                  Phone
                  <input id="admin-user-phone-input" type="tel" inputmode="tel" value="${escapeHtml(dialog.phone)}" placeholder="(555) 555-5555" />
                </label>
                <label>
                  Role
                  <select id="admin-user-role-input">
                    ${["support_agent", "sales_agent", "billing_agent", "admin", "viewer"]
                      .map(
                        (role) =>
                          `<option value="${role}" ${dialog.role === role ? "selected" : ""}>${escapeHtml(role)}</option>`,
                      )
                      .join("")}
                  </select>
                </label>
                <label>
                  Departments
                  <select id="admin-user-departments-input" multiple size="${Math.min(Math.max(departmentOptions.length, 3), 6)}">
                    ${departmentOptions
                      .map(
                        (department) => `<option value="${escapeHtml(department.id)}" ${
                          selectedDepartments.has(department.id) ? "selected" : ""
                        }>${escapeHtml(department.label)} (${escapeHtml(department.id)})</option>`,
                      )
                      .join("")}
                  </select>
                </label>
                <label>
                  Allowed products
                  <input id="admin-user-products-input" value="${escapeHtml(dialog.allowedProducts)}" placeholder="merxus" />
                </label>
                <label>
                  Allowed tenants/customers
                  <input id="admin-user-tenants-input" value="${escapeHtml(dialog.allowedTenantIds)}" placeholder="default, tenant_a" />
                </label>
                <label class="checkbox-row">
                  <input id="admin-user-active-input" type="checkbox" ${dialog.active ? "checked" : ""} />
                  Active
                </label>
              `
              : `
                <label>
                  Department id
                  <input id="admin-department-id-input" value="${escapeHtml(dialog.id)}" placeholder="sales" ${
                    dialog.mode === "edit" ? "disabled" : ""
                  } />
                  ${duplicateDepartmentId ? `<span class="field-warning">This department id already exists.</span>` : ""}
                </label>
                <label>
                  Label
                  <input id="admin-department-label-input" value="${escapeHtml(dialog.label)}" placeholder="Sales" />
                </label>
                <label>
                  Product
                  <select id="admin-department-product-input">
                    ${products
                      .map(
                        (product) => `<option value="${escapeHtml(product.id)}" ${
                          dialog.product === product.id ? "selected" : ""
                        }>${escapeHtml(product.label)}</option>`,
                      )
                      .join("")}
                  </select>
                </label>
                <label>
                  Default assignees
                  <input id="admin-department-defaults-input" value="${escapeHtml(dialog.defaultAssigneeIds)}" placeholder="user_123, user_456" />
                </label>
                <label class="checkbox-row">
                  <input id="admin-department-active-input" type="checkbox" ${dialog.active ? "checked" : ""} />
                  Active
                </label>
              `
          }
          <footer class="confirm-dialog-actions">
            <button id="admin-dialog-cancel" class="button button-quiet" type="button">Cancel</button>
            <button class="button button-primary" type="submit" ${
              state.busyAction || duplicateDepartmentId ? "disabled" : ""
            }>Save</button>
          </footer>
        </form>
      </section>
    </div>
  `;
}

function render() {
  captureSessionListScroll();
  captureDetailPanelScroll();
  const detailFocusState = captureDetailFormFocusState();

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
    <div class="console-root ${state.loadingSession ? "is-loading-session" : ""}">
      <header class="topbar">
        <div>
          <h1>Workside Support Console</h1>
          <p>Live transfer-to-human operations</p>
        </div>
        <div class="status-strip">
          <span class="${realtimeStatusClass(state.realtimeStatus)}"></span>
          <span>${realtimeStatusLabel(state.realtimeStatus)}</span>
          <span class="queue-pill">Queue ${transferQueueCount}</span>
          <span class="queue-pill">${escapeHtml(roleBadgeLabel())}</span>
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
          ${
            isSuperAdminRole()
              ? `<button id="admin-toggle-button" class="button" type="button">${
                  state.adminPanelOpen ? "Hide Admin" : "Admin"
                }</button>`
              : ""
          }
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
      ${renderAdminPanel()}
      ${state.showDiagnostics ? renderDiagnosticsPanel() : ""}
    </div>
    ${renderConfirmDialog()}
    ${renderAssignDialog()}
    ${renderTranscriptDialog()}
    ${renderAdminDialog()}
  `;

  bindEvents();
  restoreSessionListScroll();
  scrollSelectedSessionIntoView();
  restoreDetailPanelScroll();
  restoreDetailFormFocusState(detailFocusState);
}

function bindEvents() {
  const confirmDialogCancelButton = document.querySelector("#confirm-dialog-cancel");
  if (confirmDialogCancelButton) {
    confirmDialogCancelButton.addEventListener("click", () => {
      closeConfirmDialog(false);
    });
  }

  const confirmDialogConfirmButton = document.querySelector("#confirm-dialog-confirm");
  if (confirmDialogConfirmButton) {
    confirmDialogConfirmButton.addEventListener("click", () => {
      closeConfirmDialog(true);
    });
  }

  const confirmDialogBackdrop = document.querySelector("#confirm-dialog-backdrop");
  if (confirmDialogBackdrop) {
    confirmDialogBackdrop.addEventListener("click", (event) => {
      if (event.target === confirmDialogBackdrop) {
        closeConfirmDialog(false);
      }
    });
  }

  if (state.confirmDialog?.open && confirmDialogConfirmButton) {
    setTimeout(() => {
      confirmDialogConfirmButton.focus();
    }, 0);
  }

  const assignDialogCancelButton = document.querySelector("#assign-dialog-cancel");
  if (assignDialogCancelButton) {
    assignDialogCancelButton.addEventListener("click", handleCloseAssignDialog);
  }

  const assignDialogBackdrop = document.querySelector("#assign-dialog-backdrop");
  if (assignDialogBackdrop) {
    assignDialogBackdrop.addEventListener("click", (event) => {
      if (event.target === assignDialogBackdrop) {
        handleCloseAssignDialog();
      }
    });
  }

  const assignDepartmentInput = document.querySelector("#assign-department-input");
  if (assignDepartmentInput) {
    assignDepartmentInput.addEventListener("change", async (event) => {
      state.assignDialog.departmentId = String(event.target.value ?? "").trim();
      state.assignDialog.assignedToUserId = "";
      await loadAssignmentOptions(getSelectedSessionContext());
    });
  }

  const assignUserInput = document.querySelector("#assign-user-input");
  if (assignUserInput) {
    assignUserInput.addEventListener("change", (event) => {
      state.assignDialog.assignedToUserId = String(event.target.value ?? "").trim();
      render();
    });
  }

  const assignNoteInput = document.querySelector("#assign-note-input");
  if (assignNoteInput) {
    assignNoteInput.addEventListener("input", (event) => {
      state.assignDialog.note = event.target.value;
    });
  }

  const assignNotifyInput = document.querySelector("#assign-notify-input");
  if (assignNotifyInput) {
    assignNotifyInput.addEventListener("change", (event) => {
      state.assignDialog.notifyAssignee = Boolean(event.target.checked);
    });
  }

  const assignSummaryInput = document.querySelector("#assign-summary-input");
  if (assignSummaryInput) {
    assignSummaryInput.addEventListener("change", (event) => {
      state.assignDialog.includeTranscriptSummary = Boolean(event.target.checked);
    });
  }

  const assignSessionForm = document.querySelector("#assign-session-form");
  if (assignSessionForm) {
    assignSessionForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleAssignSession();
    });
  }

  const transcriptDialogCancelButton = document.querySelector("#transcript-dialog-cancel");
  if (transcriptDialogCancelButton) {
    transcriptDialogCancelButton.addEventListener("click", handleCloseTranscriptDialog);
  }

  const transcriptDialogBackdrop = document.querySelector("#transcript-dialog-backdrop");
  if (transcriptDialogBackdrop) {
    transcriptDialogBackdrop.addEventListener("click", (event) => {
      if (event.target === transcriptDialogBackdrop) {
        handleCloseTranscriptDialog();
      }
    });
  }

  const transcriptToInput = document.querySelector("#transcript-to-input");
  if (transcriptToInput) {
    transcriptToInput.addEventListener("input", (event) => {
      state.transcriptDialog.to = event.target.value;
    });
  }

  const transcriptSubjectInput = document.querySelector("#transcript-subject-input");
  if (transcriptSubjectInput) {
    transcriptSubjectInput.addEventListener("input", (event) => {
      state.transcriptDialog.subject = event.target.value;
    });
  }

  const transcriptAiInput = document.querySelector("#transcript-ai-input");
  if (transcriptAiInput) {
    transcriptAiInput.addEventListener("change", (event) => {
      state.transcriptDialog.includeAiMessages = Boolean(event.target.checked);
    });
  }

  const transcriptAgentInput = document.querySelector("#transcript-agent-input");
  if (transcriptAgentInput) {
    transcriptAgentInput.addEventListener("change", (event) => {
      state.transcriptDialog.includeAgentMessages = Boolean(event.target.checked);
    });
  }

  const transcriptSystemInput = document.querySelector("#transcript-system-input");
  if (transcriptSystemInput) {
    transcriptSystemInput.addEventListener("change", (event) => {
      state.transcriptDialog.includeSystemMessages = Boolean(event.target.checked);
    });
  }

  const transcriptForm = document.querySelector("#transcript-form");
  if (transcriptForm) {
    transcriptForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleSendTranscript();
    });
  }

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
    agentInput.addEventListener("input", (event) => {
      state.agentName = event.target.value;
      localStorage.setItem(AGENT_STORAGE_KEY, state.agentName.trim());
    });
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

  const adminToggleButton = document.querySelector("#admin-toggle-button");
  if (adminToggleButton) {
    adminToggleButton.addEventListener("click", async () => {
      state.adminPanelOpen = !state.adminPanelOpen;
      render();
      if (state.adminPanelOpen && state.adminUsers.length === 0 && state.adminDepartments.length === 0) {
        await loadAdminPanelData();
      }
    });
  }

  const adminRefreshButton = document.querySelector("#admin-refresh-button");
  if (adminRefreshButton) {
    adminRefreshButton.addEventListener("click", loadAdminPanelData);
  }

  const adminUserCreateButton = document.querySelector("#admin-user-create-button");
  if (adminUserCreateButton) {
    adminUserCreateButton.addEventListener("click", () => openAdminUserDialog());
  }

  const adminDepartmentCreateButton = document.querySelector("#admin-department-create-button");
  if (adminDepartmentCreateButton) {
    adminDepartmentCreateButton.addEventListener("click", () => openAdminDepartmentDialog());
  }

  document.querySelectorAll("[data-admin-user-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const user = state.adminUsers.find((item) => item.id === button.getAttribute("data-admin-user-edit"));
      if (user) openAdminUserDialog(user);
    });
  });

  document.querySelectorAll("[data-admin-department-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const department = state.adminDepartments.find(
        (item) => item.id === button.getAttribute("data-admin-department-edit"),
      );
      if (department) openAdminDepartmentDialog(department);
    });
  });

  document.querySelectorAll("[data-admin-department-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      await handleDeleteDepartment(button.getAttribute("data-admin-department-delete"));
    });
  });

  const adminDialogCancelButton = document.querySelector("#admin-dialog-cancel");
  if (adminDialogCancelButton) {
    adminDialogCancelButton.addEventListener("click", closeAdminDialog);
  }

  const adminDialogBackdrop = document.querySelector("#admin-dialog-backdrop");
  if (adminDialogBackdrop) {
    adminDialogBackdrop.addEventListener("click", (event) => {
      if (event.target === adminDialogBackdrop) {
        closeAdminDialog();
      }
    });
  }

  const adminDialogForm = document.querySelector("#admin-dialog-form");
  if (adminDialogForm) {
    adminDialogForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleSaveAdminDialog();
    });
  }

  const bindAdminDialogInput = (selector, key, isCheckbox = false) => {
    const input = document.querySelector(selector);
    if (!input) return;
    const eventName = isCheckbox || input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(eventName, (event) => {
      state.adminDialog[key] = isCheckbox ? Boolean(event.target.checked) : event.target.value;
      if (key === "id" && state.adminDialog.type === "department" && state.adminDialog.mode === "create") {
        render();
      }
    });
  };
  bindAdminDialogInput("#admin-user-name-input", "name");
  bindAdminDialogInput("#admin-user-email-input", "email");
  bindAdminDialogInput("#admin-user-phone-input", "phone");
  bindAdminDialogInput("#admin-user-role-input", "role");
  bindAdminDialogInput("#admin-user-products-input", "allowedProducts");
  bindAdminDialogInput("#admin-user-tenants-input", "allowedTenantIds");
  bindAdminDialogInput("#admin-user-active-input", "active", true);
  bindAdminDialogInput("#admin-department-id-input", "id");
  bindAdminDialogInput("#admin-department-label-input", "label");
  bindAdminDialogInput("#admin-department-product-input", "product");
  bindAdminDialogInput("#admin-department-defaults-input", "defaultAssigneeIds");
  bindAdminDialogInput("#admin-department-active-input", "active", true);

  const adminUserDepartmentsInput = document.querySelector("#admin-user-departments-input");
  if (adminUserDepartmentsInput) {
    adminUserDepartmentsInput.addEventListener("change", (event) => {
      state.adminDialog.departments = [...event.target.selectedOptions]
        .map((option) => option.value)
        .filter(Boolean)
        .join(", ");
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

  const assignSessionButton = document.querySelector("#assign-session-button");
  if (assignSessionButton) {
    assignSessionButton.addEventListener("click", handleOpenAssignDialog);
  }

  const sendTranscriptButton = document.querySelector("#send-transcript-button");
  if (sendTranscriptButton) {
    sendTranscriptButton.addEventListener("click", handleOpenTranscriptDialog);
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

  const leadIntakePanel = document.querySelector("#lead-intake-panel");
  if (leadIntakePanel) {
    leadIntakePanel.addEventListener("toggle", () => {
      setIntakePanelOpenState(state.selectedSessionId, "leadOpen", leadIntakePanel.open);
    });
  }

  const inquiryIntakePanel = document.querySelector("#inquiry-intake-panel");
  if (inquiryIntakePanel) {
    inquiryIntakePanel.addEventListener("toggle", () => {
      setIntakePanelOpenState(state.selectedSessionId, "inquiryOpen", inquiryIntakePanel.open);
    });
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
      const formattedPhone = formatPhoneInput(event.target.value);
      event.target.value = formattedPhone;
      state.leadDraft.phone = formattedPhone;
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

window.addEventListener("pointerdown", unlockNotificationSound, { once: true });
window.addEventListener("keydown", unlockNotificationSound, { once: true });

bootstrap();

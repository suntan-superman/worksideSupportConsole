import { request } from "./api";
import { getLatestRelease } from "./releaseArchive";

export const OPERATIONAL_PRODUCTS = [
  { id: "sageset", label: "SageSet" },
  { id: "merxus", label: "Merxus AI" },
  { id: "radiusiq", label: "RadiusIQ" },
  { id: "route-logistics", label: "Route Logistics" },
  { id: "support-console", label: "Workside Support Console" },
];

const STATUS_ORDER = new Set(["healthy", "warning", "degraded", "incident", "unknown", "stale", "unavailable"]);
const HEALTH_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const HEALTH_REQUEST_TIMEOUT_MS = 10_000;

let lastSuccessfulAt = "";

function normalizeStatus(value) {
  const status = String(value ?? "unknown").trim().toLowerCase();
  return STATUS_ORDER.has(status) ? status : "unknown";
}

function normalizeProductId(value) {
  const key = String(value ?? "").trim().toLowerCase();
  const normalized = key.replace(/[\s_]+/g, "-");
  if (normalized === "route-logistics") return "route-logistics";
  if (normalized === "merxus-ai") return "merxus";
  if (normalized === "radius-iq") return "radiusiq";
  if (normalized === "workside-support-console") return "support-console";
  return normalized;
}

function normalizeHealthItem(item = {}, now = Date.now()) {
  const rawId = String(item.id ?? item.productId ?? item.product ?? item.label ?? item.name ?? "").trim();
  const normalizedId = normalizeProductId(rawId);
  const fallback = OPERATIONAL_PRODUCTS.find((product) => product.id === normalizedId);
  const updatedAt = String(item.updatedAt ?? item.checkedAt ?? item.lastUpdatedAt ?? "");
  const age = updatedAt ? now - Date.parse(updatedAt) : Number.POSITIVE_INFINITY;
  const declaredFreshness = String(item.freshness ?? item.sourceFreshness ?? "").trim().toLowerCase();
  let freshness = "unknown";
  if (declaredFreshness === "unavailable") {
    freshness = "unavailable";
  } else if (declaredFreshness === "stale" || (Number.isFinite(age) && age > HEALTH_MAX_AGE_MS)) {
    freshness = "stale";
  } else if (Number.isFinite(age) && age >= 0) {
    freshness = "current";
  }
  const normalizeSignal = (value) => {
    const status = normalizeStatus(value);
    if (freshness === "unavailable" && ["healthy", "warning"].includes(status)) return "unavailable";
    if (freshness === "stale" && status !== "unknown" && status !== "unavailable") return "stale";
    if (freshness === "unknown" && ["healthy", "warning"].includes(status)) return "unknown";
    return status;
  };
  return {
    id: fallback?.id ?? (normalizedId || "unknown"),
    label: String(item.label ?? item.name ?? fallback?.label ?? rawId ?? "Unknown Product"),
    status: normalizeSignal(item.status ?? item.health),
    latestRelease: String(item.latestRelease ?? item.version ?? item.build ?? ""),
    readinessScore: item.readinessScore === undefined || item.readinessScore === null ? null : Number(item.readinessScore),
    qa: normalizeSignal(item.qa ?? item.qaStatus),
    meta: normalizeSignal(item.meta ?? item.metaStatus),
    stripe: normalizeSignal(item.stripe ?? item.stripeStatus),
    auth: normalizeSignal(item.auth ?? item.authStatus),
    email: normalizeSignal(item.email ?? item.emailStatus),
    notifications: normalizeSignal(item.notifications ?? item.notificationStatus),
    latestReportUrl: String(item.latestReportUrl ?? item.reportUrl ?? ""),
    updatedAt,
    freshness,
    recordState: "reported",
    sourceErrors: Array.isArray(item.sourceErrors) ? item.sourceErrors.map(String) : [],
    sourceMetadata: item.sourceMetadata && typeof item.sourceMetadata === "object" ? item.sourceMetadata : {},
  };
}

function collectionFromPayload(payload) {
  if (Array.isArray(payload)) {
    return {
      records: payload,
      valid: payload.every((item) => item && typeof item === "object" && !Array.isArray(item)),
    };
  }
  const value =
    payload?.items ??
    payload?.products ??
    payload?.health ??
    payload?.data?.items ??
    payload?.data?.products ??
    payload?.data?.health ??
    payload?.data ??
    payload;
  if (!Array.isArray(value)) return { records: [], valid: false };
  return {
    records: value,
    valid: value.every((item) => item && typeof item === "object" && !Array.isArray(item)),
  };
}

function fallbackProducts() {
  return OPERATIONAL_PRODUCTS.map((product) => ({
    ...normalizeHealthItem({ ...product }),
    recordState: "missing",
  }));
}

function classifyHealthError(error) {
  if (error?.name === "AbortError" || error?.name === "TimeoutError") return "timeout";
  if (error?.status === 401 || error?.status === 403) return "unauthorized";
  if (error?.status === 404) return "not_found";
  if (error?.status) return "unavailable";
  return "network_error";
}

function latestReleaseVersion(release) {
  return String(release?.version ?? release?.release ?? release?.build ?? "").trim();
}

export async function getProductHealth({ now = Date.now() } = {}) {
  const [healthResult, releases] = await Promise.all([
    (async () => {
      try {
        const signal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS)
          : undefined;
        const payload = await request("/support/products/health", { method: "GET", signal });
        const collection = collectionFromPayload(payload);
        if (!collection.valid) return { state: "malformed", items: [] };
        return { state: "available", items: collection.records.map((item) => normalizeHealthItem(item, now)) };
      } catch (error) {
        return { state: classifyHealthError(error), items: [] };
      }
    })(),
    Promise.all(OPERATIONAL_PRODUCTS.map((product) => getLatestRelease(product.id))),
  ]);

  const releasesByProduct = new Map(OPERATIONAL_PRODUCTS.map((product, index) => [product.id, releases[index]]));
  let products;
  let missingProducts = [];
  let staleProducts = [];
  let unavailableProducts = [];
  let unknownFreshnessProducts = [];
  let state = healthResult.state;

  if (healthResult.state === "available") {
    const byId = new Map(healthResult.items.map((item) => [item.id, item]));
    products = OPERATIONAL_PRODUCTS.map((product) => {
      const record = byId.get(product.id);
      const releaseVersion = latestReleaseVersion(releasesByProduct.get(product.id));
      if (!record) {
        missingProducts.push(product.label);
        return { ...normalizeHealthItem({ ...product }, now), recordState: "missing", latestRelease: releaseVersion };
      }
      return {
        ...record,
        latestRelease: releaseVersion || record.latestRelease,
      };
    });
    products.push(...healthResult.items.filter((item) => !OPERATIONAL_PRODUCTS.some((product) => product.id === item.id)));
    if (missingProducts.length) state = "partial";
    staleProducts = products.filter((item) => item.freshness === "stale").map((item) => item.label);
    unavailableProducts = products.filter((item) => item.freshness === "unavailable").map((item) => item.label);
    unknownFreshnessProducts = products
      .filter((item) => item.recordState === "reported" && item.freshness === "unknown")
      .map((item) => item.label);
    if (staleProducts.length && state === "available") state = "stale";
    if (unavailableProducts.length && state === "available") state = "partial";
    if (unknownFreshnessProducts.length && state === "available") state = "partial";
    lastSuccessfulAt = new Date(now).toISOString();
  } else {
    products = fallbackProducts().map((product) => ({
      ...product,
      latestRelease: latestReleaseVersion(releasesByProduct.get(product.id)),
    }));
  }

  return {
    products,
    feedState: state,
    missingProducts,
    staleProducts,
    unavailableProducts,
    unknownFreshnessProducts,
    lastSuccessfulAt,
  };
}

export async function listProductHealth() {
  try {
    return (await getProductHealth()).products;
  } catch {
    return fallbackProducts();
  }
}

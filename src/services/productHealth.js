import { request } from "./api";

export const OPERATIONAL_PRODUCTS = [
  { id: "sageset", label: "SageSet" },
  { id: "merxus", label: "Merxus AI" },
  { id: "radiusiq", label: "RadiusIQ" },
  { id: "support-console", label: "Workside Support Console" },
];

const STATUS_ORDER = new Set(["healthy", "warning", "degraded", "incident", "unknown"]);

function normalizeStatus(value) {
  const status = String(value ?? "unknown").trim().toLowerCase();
  return STATUS_ORDER.has(status) ? status : "unknown";
}

function normalizeHealthItem(item = {}) {
  const id = String(item.id ?? item.productId ?? item.product ?? "").trim();
  const fallback = OPERATIONAL_PRODUCTS.find((product) => product.id === id);
  return {
    id: id || fallback?.id || "unknown",
    label: String(item.label ?? item.name ?? fallback?.label ?? id ?? "Unknown Product"),
    status: normalizeStatus(item.status ?? item.health),
    latestRelease: String(item.latestRelease ?? item.version ?? item.build ?? ""),
    readinessScore: item.readinessScore === undefined || item.readinessScore === null ? null : Number(item.readinessScore),
    qa: normalizeStatus(item.qa ?? item.qaStatus),
    meta: normalizeStatus(item.meta ?? item.metaStatus),
    stripe: normalizeStatus(item.stripe ?? item.stripeStatus),
    auth: normalizeStatus(item.auth ?? item.authStatus),
    email: normalizeStatus(item.email ?? item.emailStatus),
    notifications: normalizeStatus(item.notifications ?? item.notificationStatus),
    latestReportUrl: String(item.latestReportUrl ?? item.reportUrl ?? ""),
    updatedAt: String(item.updatedAt ?? item.checkedAt ?? ""),
  };
}

function collectionFromPayload(payload) {
  const value = payload?.items ?? payload?.products ?? payload?.health ?? payload?.data?.items ?? payload?.data ?? payload;
  return Array.isArray(value) ? value : [];
}

export async function listProductHealth() {
  try {
    const payload = await request("/support/products/health", { method: "GET" });
    const healthItems = collectionFromPayload(payload).map(normalizeHealthItem);
    if (healthItems.length) return healthItems;
  } catch {
    // Product health is additive. Unknown rows keep the operations UI honest.
  }

  return OPERATIONAL_PRODUCTS.map((product) =>
    normalizeHealthItem({
      ...product,
      status: "unknown",
      qa: "unknown",
      meta: "unknown",
      stripe: "unknown",
      auth: "unknown",
      email: "unknown",
      notifications: "unknown",
    }),
  );
}

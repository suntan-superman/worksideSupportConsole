import { request } from "./api";

const LATEST_RELEASE_CACHE_MS = 5 * 60 * 1000;
const latestReleaseCache = new Map();

function normalizeRelease(item = {}) {
  return {
    id: String(item.id ?? item.releaseId ?? item.date ?? item.version ?? ""),
    product: String(item.product ?? item.productId ?? ""),
    version: String(item.version ?? item.release ?? item.build ?? ""),
    date: String(item.date ?? item.createdAt ?? item.generatedAt ?? ""),
    readinessScore: item.readinessScore === undefined || item.readinessScore === null ? null : Number(item.readinessScore),
    recommendation: String(item.recommendation ?? item.deploymentRecommendation ?? "unknown"),
    htmlUrl: String(item.htmlUrl ?? item.reportHtmlUrl ?? item.reportUrl ?? ""),
    jsonUrl: String(item.jsonUrl ?? item.reportJsonUrl ?? ""),
    pdfUrl: String(item.pdfUrl ?? item.certificateUrl ?? ""),
    status: String(item.status ?? item.result ?? "unknown"),
  };
}

function collectionFromPayload(payload) {
  const value = payload?.items ?? payload?.releases ?? payload?.data?.items ?? payload?.data?.releases ?? payload?.data ?? payload;
  return Array.isArray(value) ? value : [];
}

export async function listReleaseArchive(productId) {
  if (!productId) return [];
  try {
    const payload = await request(`/support/products/${encodeURIComponent(productId)}/releases`, { method: "GET" });
    return collectionFromPayload(payload).map((item) => normalizeRelease({ ...item, product: item.product ?? productId }));
  } catch {
    return [];
  }
}

export async function getLatestRelease(productId) {
  if (!productId) return null;
  const cached = latestReleaseCache.get(productId);
  if (cached && Date.now() - cached.loadedAt < LATEST_RELEASE_CACHE_MS) {
    return cached.release;
  }
  try {
    const payload = await request(`/support/products/${encodeURIComponent(productId)}/releases/latest`, { method: "GET" });
    const release = normalizeRelease(payload?.release ?? payload?.data?.release ?? payload?.data ?? payload);
    if (release.version || release.id || release.date) {
      latestReleaseCache.set(productId, { release, loadedAt: Date.now() });
    }
    return release;
  } catch {
    latestReleaseCache.set(productId, { release: null, loadedAt: Date.now() });
    return null;
  }
}

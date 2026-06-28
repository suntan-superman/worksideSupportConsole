import { request } from "./api";

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
  try {
    const payload = await request(`/support/products/${encodeURIComponent(productId)}/releases/latest`, { method: "GET" });
    return normalizeRelease(payload?.release ?? payload?.data?.release ?? payload?.data ?? payload);
  } catch {
    return null;
  }
}

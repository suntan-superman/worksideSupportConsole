import { getProductHealth } from "./productHealth";
import { getLatestRelease } from "./releaseArchive";

function canonicalProductId(value) {
  const key = String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (key === "merxus-ai") return "merxus";
  if (key === "radius-iq") return "radiusiq";
  if (key === "workside-support-console") return "support-console";
  return key;
}

export async function getSessionProductDiagnostics(session = {}) {
  const product = canonicalProductId(session.productKey ?? session.product);
  if (!product) {
    return {
      product: "",
      health: null,
      latestRelease: null,
      warnings: ["Session is missing product context."],
    };
  }

  const [healthResult, latestRelease] = await Promise.all([getProductHealth(), getLatestRelease(product)]);
  const health = healthResult.products.find((item) => item.id === product) ?? null;
  const warnings = [];

  if (["unauthorized", "not_found", "unavailable", "network_error", "timeout", "malformed"].includes(healthResult.feedState)) {
    warnings.push(`Product health data is ${healthResult.feedState.replaceAll("_", " ")}.`);
  } else if (!health || health.recordState === "missing") {
    warnings.push("No product health record is available.");
  }
  if (health && health.status !== "healthy") warnings.push(`Product health is ${health.status}.`);
  if (!latestRelease) warnings.push("No release certification record is available.");

  return {
    product,
    health,
    latestRelease,
    warnings,
  };
}

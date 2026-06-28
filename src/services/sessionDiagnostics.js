import { listProductHealth } from "./productHealth";
import { getLatestRelease } from "./releaseArchive";

export async function getSessionProductDiagnostics(session = {}) {
  const product = String(session.productKey ?? session.product ?? "").trim();
  if (!product) {
    return {
      product: "",
      health: null,
      latestRelease: null,
      warnings: ["Session is missing product context."],
    };
  }

  const [healthItems, latestRelease] = await Promise.all([listProductHealth(), getLatestRelease(product)]);
  const health = healthItems.find((item) => item.id === product) ?? null;
  const warnings = [];

  if (!health) warnings.push("No product health record is available.");
  if (health && health.status !== "healthy") warnings.push(`Product health is ${health.status}.`);
  if (!latestRelease) warnings.push("No release certification record is available.");

  return {
    product,
    health,
    latestRelease,
    warnings,
  };
}

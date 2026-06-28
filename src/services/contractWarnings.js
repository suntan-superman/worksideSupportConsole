const warningCounts = {};

export function recordContractFallbackWarning(field, source = "unknown") {
  const key = `${source}:${field}`;
  warningCounts[key] = (warningCounts[key] ?? 0) + 1;
  if (import.meta.env?.DEV) {
    console.warn(`[contract-fallback] ${field} used from ${source}`);
  }
}

export function getContractFallbackWarnings() {
  return { ...warningCounts };
}

export function clearContractFallbackWarnings() {
  Object.keys(warningCounts).forEach((key) => {
    delete warningCounts[key];
  });
}

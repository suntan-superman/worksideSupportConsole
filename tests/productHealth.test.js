import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock, getLatestReleaseMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  getLatestReleaseMock: vi.fn(),
}));

vi.mock("../src/services/api.js", () => ({ request: requestMock }));
vi.mock("../src/services/releaseArchive.js", () => ({ getLatestRelease: getLatestReleaseMock }));

import { getProductHealth, OPERATIONAL_PRODUCTS } from "../src/services/productHealth.js";

const NOW = Date.parse("2026-11-17T18:00:00.000Z");
const CURRENT = new Date(NOW - 60_000).toISOString();

function healthRecord(id, fields = {}) {
  return {
    id,
    status: "healthy",
    qa: "healthy",
    meta: "healthy",
    stripe: "healthy",
    auth: "healthy",
    email: "healthy",
    notifications: "healthy",
    updatedAt: CURRENT,
    ...fields,
  };
}

describe("product health feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestMock.mockResolvedValue({ items: [] });
    getLatestReleaseMock.mockResolvedValue(null);
  });

  it("keeps all five canonical products in the dashboard catalog", () => {
    expect(OPERATIONAL_PRODUCTS.map(({ id }) => id)).toEqual([
      "sageset",
      "merxus",
      "radiusiq",
      "route-logistics",
      "support-console",
    ]);
  });

  it("accepts a complete current health response", async () => {
    requestMock.mockResolvedValueOnce({
      items: OPERATIONAL_PRODUCTS.map(({ id }) => healthRecord(id)),
    });

    const result = await getProductHealth({ now: NOW });
    expect(result.feedState).toBe("available");
    expect(result.products).toHaveLength(5);
    expect(result.products.every(({ freshness, status }) => freshness === "current" && status === "healthy")).toBe(true);
    expect(result.lastSuccessfulAt).toBe(new Date(NOW).toISOString());
  });

  it("normalizes Route Logistics aliases and keeps its release and status separate", async () => {
    requestMock.mockResolvedValueOnce({
      items: [
        healthRecord("merxus", { status: "degraded", latestRelease: "old-merxus" }),
        healthRecord("route_logistics", { label: "Route Logistics", latestRelease: "old-route" }),
      ],
    });
    getLatestReleaseMock.mockImplementation(async (id) =>
      id === "route-logistics" ? { version: "route-2.4" } : id === "merxus" ? { version: "merxus-9.1" } : null,
    );

    const result = await getProductHealth({ now: NOW });
    const route = result.products.find(({ id }) => id === "route-logistics");
    const merxus = result.products.find(({ id }) => id === "merxus");

    expect(route).toMatchObject({ id: "route-logistics", status: "healthy", latestRelease: "route-2.4" });
    expect(merxus).toMatchObject({ status: "degraded", latestRelease: "merxus-9.1" });
    expect(result.feedState).toBe("partial");
  });

  it("keeps products with no health row visible as missing and unknown", async () => {
    requestMock.mockResolvedValueOnce({ items: [healthRecord("route-logistics")] });

    const result = await getProductHealth({ now: NOW });
    expect(result.products).toHaveLength(5);
    expect(result.products.find(({ id }) => id === "route-logistics")).toMatchObject({
      status: "healthy",
      recordState: "reported",
    });
    expect(result.products.find(({ id }) => id === "sageset")).toMatchObject({
      status: "unknown",
      recordState: "missing",
    });
    expect(result.missingProducts).toContain("SageSet");
    expect(result.feedState).toBe("partial");
  });

  it("treats a successful empty collection as partial data", async () => {
    requestMock.mockResolvedValueOnce({ items: [] });
    const result = await getProductHealth({ now: NOW });

    expect(result.feedState).toBe("partial");
    expect(result.products).toHaveLength(5);
    expect(result.products.every(({ status }) => status === "unknown")).toBe(true);
  });

  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [404, "not_found"],
    [500, "unavailable"],
  ])("reports HTTP %i as %s while keeping all products visible", async (status, expectedState) => {
    requestMock.mockRejectedValueOnce(Object.assign(new Error("private backend detail"), { status }));
    const result = await getProductHealth({ now: NOW });

    expect(result.feedState).toBe(expectedState);
    expect(result.products).toHaveLength(5);
    expect(result.products.every(({ status: productStatus }) => productStatus === "unknown")).toBe(true);
  });

  it("classifies request timeouts and malformed responses", async () => {
    requestMock.mockRejectedValueOnce(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
    const timeout = await getProductHealth({ now: NOW });
    requestMock.mockResolvedValueOnce({ items: "not-an-array" });
    const malformed = await getProductHealth({ now: NOW });

    expect(timeout.feedState).toBe("timeout");
    expect(malformed.feedState).toBe("malformed");
  });

  it("classifies network errors without exposing exception details", async () => {
    requestMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const result = await getProductHealth({ now: NOW });
    expect(result.feedState).toBe("network_error");
    expect(JSON.stringify(result)).not.toContain("Failed to fetch");
  });

  it("marks old records stale and does not present their old healthy status as current", async () => {
    requestMock.mockResolvedValueOnce({ items: [healthRecord("route-logistics", {
      updatedAt: "2026-11-15T00:00:00.000Z",
    })] });

    const result = await getProductHealth({ now: NOW });
    expect(result.feedState).toBe("partial");
    expect(result.products.find(({ id }) => id === "route-logistics")).toMatchObject({
      status: "stale",
      qa: "stale",
      freshness: "stale",
    });
  });

  it("uses latest release records when the health endpoint is unavailable", async () => {
    requestMock.mockRejectedValueOnce(Object.assign(new Error("missing"), { status: 404 }));
    getLatestReleaseMock.mockImplementation(async (id) => id === "route-logistics" ? { version: "route-2.4" } : null);

    const result = await getProductHealth({ now: NOW });
    expect(result.feedState).toBe("not_found");
    expect(result.products.find(({ id }) => id === "route-logistics")).toMatchObject({
      status: "unknown",
      latestRelease: "route-2.4",
    });
  });
});

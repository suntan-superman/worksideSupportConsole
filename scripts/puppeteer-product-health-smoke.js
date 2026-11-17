#!/usr/bin/env node

import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import process from "node:process";
import puppeteer from "puppeteer";

const PORT = Number(process.env.PUPPETEER_SMOKE_PORT || 4177);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const now = "2026-06-28T18:00:00.000Z";

const json = (payload) => ({
  status: 200,
  contentType: "application/json",
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, accept",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  },
  body: JSON.stringify(payload),
});

const emptyCors = {
  status: 204,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, accept",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  },
};

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {
      // Keep waiting for Vite.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${BASE_URL}`);
}

function startServer() {
  const child = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(PORT)], {
    cwd: process.cwd(),
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function installApiMocks(page) {
  const interceptedSupportPaths = [];
  page.__supportPaths = interceptedSupportPaths;
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.includes("/support")) interceptedSupportPaths.push(path);

    if (request.method() === "OPTIONS" && path.includes("/support")) {
      request.respond(emptyCors);
      return;
    }

    if (path === "/support/products/health") {
      request.respond(
        json({
          items: [],
        }),
      );
      return;
    }

    if (/^\/support\/products\/[^/]+\/releases\/latest$/.test(path)) {
      request.respond({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "RELEASE_NOT_FOUND" } }),
      });
      return;
    }

    if (path === "/support/products") {
      request.respond(json({ products: [
        { id: "sageset", label: "SageSet" },
        { id: "merxus", label: "Merxus AI" },
        { id: "radiusiq", label: "RadiusIQ" },
        { id: "route-logistics", label: "Route Logistics" },
        { id: "support-console", label: "Workside Support Console" },
      ] }));
      return;
    }

    if (path === "/support/tenants") {
      request.respond(json({ tenants: [{ id: "tenantA", tenantId: "tenantA", name: "Tenant A", product: "merxus" }] }));
      return;
    }

    if (path === "/support/users/me/availability") {
      request.respond(
        json({
          availability: {
            status: "available",
            effectiveStatus: "available",
            lastSeenAt: now,
            updatedAt: now,
            assignable: true,
          },
        }),
      );
      return;
    }

    if (path === "/support/users/me/heartbeat") {
      request.respond(json({ ok: true, lastSeenAt: now }));
      return;
    }

    if (path === "/support/users" || path === "/support/admin/users") {
      request.respond(
        json({
          users: [
            {
              id: "agentA",
              name: "Stan Roy",
              email: "stan@example.com",
              role: "super_admin",
              active: true,
              departments: ["general"],
              allowedProducts: ["__all__"],
              allowedTenantIds: ["__all__"],
            },
          ],
        }),
      );
      return;
    }

    if (path === "/support/sessions/smoke-1/notifications") {
      request.respond(
        json({
          items: [
            {
              id: "n1",
              sessionId: "smoke-1",
              product: "merxus",
              channel: "email",
              provider: "sendgrid",
              recipientLabel: "stan@example.com",
              status: "delivered",
              attemptedAt: now,
            },
          ],
        }),
      );
      return;
    }

    if (path === "/support/sessions/smoke-1") {
      request.respond(
        json({
          session: {
            id: "smoke-1",
            tenantId: "tenantA",
            tenantName: "Tenant A",
            product: "merxus",
            status: "escalated",
            transferRequested: true,
            leadName: "Ada Lovelace",
            leadEmail: "ada@example.com",
            routingStatus: "assigned",
            availabilityOutcome: "available_agent_found",
            updatedAt: now,
            createdAt: now,
          },
          messages: [{ id: "m1", sender: "visitor", body: "Can I talk to a person?", createdAt: now }],
        }),
      );
      return;
    }

    if (path === "/support/sessions") {
      request.respond(
        json({
          sessions: [
            {
              id: "smoke-1",
              tenantId: "tenantA",
              tenantName: "Tenant A",
              product: "merxus",
              status: "escalated",
              transferRequested: true,
              leadName: "Ada Lovelace",
              leadEmail: "ada@example.com",
              routingStatus: "assigned",
              availabilityOutcome: "available_agent_found",
              updatedAt: now,
              createdAt: now,
            },
          ],
        }),
      );
      return;
    }

    request.continue();
  });
}

async function main() {
  const server = startServer();
  let browser;
  try {
    await waitForServer();
    browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await installApiMocks(page);
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem("workside_support_auth_token", "puppeteer-smoke-token");
      localStorage.setItem("workside_support_role", "super_admin");
    });

    await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 60_000 });
    await page.waitForSelector(".operations-panel", { timeout: 30_000 });
    await page.waitForFunction(
      () => document.body.innerText.includes("Product Health") && document.body.innerText.includes("Route Logistics"),
      { timeout: 30_000 },
    );
    const bodyText = await page.evaluate(() => document.body.innerText);

    for (const expected of ["Product Health", "Release Archive", "Unknown", "Sessions", "Ada Lovelace"]) {
      if (!bodyText.includes(expected)) {
        throw new Error(`Missing expected text: ${expected}`);
      }
    }

    for (const expected of ["SageSet", "Merxus AI", "RadiusIQ", "Route Logistics", "Workside Support Console"]) {
      if (!bodyText.includes(expected)) {
        throw new Error(`Missing Product Health catalog entry: ${expected}`);
      }
    }
    if (!(await page.$eval('#support-filter-product option[value="route-logistics"]', (option) => Boolean(option)).catch(() => false))) {
      throw new Error("Route Logistics is missing from the support Product filter.");
    }
    for (const expectedPath of [
      "/support/products/health",
      "/support/products/route-logistics/releases/latest",
      "/support/users/me/heartbeat",
    ]) {
      if (!(page.__supportPaths || []).includes(expectedPath)) {
        throw new Error(`Expected support request was not made: ${expectedPath}`);
      }
    }

    await page.click('[data-testid="session-row"]');
    await page.waitForFunction(() => document.body.innerText.includes("Notifications"), { timeout: 30_000 });
    const detailText = await page.evaluate(() => document.body.innerText);
    for (const expected of ["Product Context", "Latest Release", "Routing / Notifications", "Notifications", "sendgrid | stan@example.com"]) {
      if (!detailText.includes(expected)) {
        throw new Error(`Missing expected detail text: ${expected}`);
      }
    }

    console.log("Puppeteer product health smoke passed.");
  } finally {
    if (browser) await browser.close();
    if (process.platform === "win32" && server.pid) {
      try {
        execFileSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
      } catch {
        // The process may already be gone.
      }
    } else {
      server.kill();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

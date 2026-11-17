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
          items: [
            {
              id: "merxus",
              label: "Merxus AI",
              status: "healthy",
              latestRelease: "2026.06.28",
              readinessScore: 94,
              qa: "healthy",
              meta: "unknown",
              stripe: "healthy",
              auth: "healthy",
              email: "healthy",
              notifications: "warning",
              updatedAt: now,
            },
          ],
        }),
      );
      return;
    }

    if (path === "/support/products/merxus/releases/latest") {
      request.respond(
        json({
          release: {
            id: "2026-06-28",
            product: "merxus",
            version: "2026.06.28",
            readinessScore: 94,
            recommendation: "deploy",
            status: "passed",
          },
        }),
      );
      return;
    }

    if (path === "/support/products/merxus/releases") {
      request.respond(
        json({
          releases: [
            {
              id: "2026-06-28",
              product: "merxus",
              version: "2026.06.28",
              date: "2026-06-28",
              readinessScore: 94,
              recommendation: "deploy",
              status: "passed",
              htmlUrl: "/reports/merxus/2026-06-28.html",
              jsonUrl: "/reports/merxus/2026-06-28.json",
              pdfUrl: "/reports/merxus/2026-06-28.pdf",
            },
          ],
        }),
      );
      return;
    }

    if (path === "/support/products") {
      request.respond(json({ products: [{ id: "merxus", label: "Merxus AI" }] }));
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
    try {
      await page.waitForFunction(() => document.body.innerText.includes("2026.06.28"), { timeout: 30_000 });
    } catch (error) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      const supportPaths = page.__supportPaths || [];
      throw new Error(
        `${error.message}\nSupport requests: ${supportPaths.join(", ") || "none"}\nBody:\n${bodyText.slice(0, 2000)}`,
      );
    }
    const bodyText = await page.evaluate(() => document.body.innerText);

    for (const expected of ["Product Health", "Release Archive", "2026-06-28", "2026.06.28", "Sessions", "Ada Lovelace"]) {
      if (!bodyText.includes(expected)) {
        throw new Error(`Missing expected text: ${expected}`);
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

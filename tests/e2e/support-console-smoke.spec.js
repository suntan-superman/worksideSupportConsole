import { expect, test } from "@playwright/test";

const now = "2026-05-03T18:00:00.000Z";

test("loads sessions and selects a session detail", async ({ page }) => {
  await page.route("**/support/products**", (route) =>
    route.fulfill({
      json: { products: [{ id: "merxus", label: "Merxus AI" }] },
    }),
  );
  await page.route("**/support/tenants**", (route) =>
    route.fulfill({
      json: { tenants: [{ tenantId: "tenantA", name: "Tenant A", product: "merxus" }] },
    }),
  );
  await page.route("**/support/users/me/availability", (route) =>
    route.fulfill({
      json: {
        availability: {
          status: "available",
          effectiveStatus: "available",
          lastSeenAt: now,
          updatedAt: now,
          assignable: true,
        },
      },
    }),
  );
  await page.route("**/support/users/me/heartbeat", (route) =>
    route.fulfill({ json: { ok: true, lastSeenAt: now } }),
  );
  await page.route("**/support/users**", (route) =>
    route.fulfill({
      json: {
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
      },
    }),
  );
  await page.route("**/support/sessions/smoke-1**", (route) =>
    route.fulfill({
      json: {
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
          assignedTo: { id: "agentA", name: "Stan Roy", email: "stan@example.com" },
          departmentId: "general",
          departmentLabel: "General",
          updatedAt: now,
          createdAt: now,
          support: {
            routing: {
              notificationStatus: {
                attempted: true,
                muted: false,
                channelResults: [{ channel: "email", recipient: "stan@example.com", status: "sent", attemptedAt: now }],
              },
            },
          },
        },
        messages: [{ id: "m1", sender: "visitor", body: "Can I talk to a person?", createdAt: now }],
      },
    }),
  );
  await page.route("**/support/sessions**", (route) =>
    route.request().url().includes("/support/sessions/smoke-1")
      ? route.fallback()
      : route.fulfill({
          json: {
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
          },
        }),
  );

  await page.addInitScript(() => {
    localStorage.setItem("workside_support_auth_token", "smoke-token");
    localStorage.setItem("workside_support_role", "super_admin");
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();
  await page.getByRole("button", { name: /Ada Lovelace/ }).click();
  await expect(page.getByRole("heading", { name: /Session smoke-1/ })).toBeVisible();
  await expect(page.getByText("Routing / Notifications")).toBeVisible();
  await expect(page.getByText("email to stan@example.com")).toBeVisible();
});

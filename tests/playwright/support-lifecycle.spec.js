import { expect, test } from "@playwright/test";
import { hasSupportCredentials, supportCredentials, supportConsoleUrl } from "../supportCredentials.js";

test.skip(
  !hasSupportCredentials() || process.env.PLAYWRIGHT_RUN_SUPPORT_LIFECYCLE !== "true",
  "Set support credentials and PLAYWRIGHT_RUN_SUPPORT_LIFECYCLE=true to run lifecycle tests.",
);

test("support lifecycle smoke: login, queue, select, optional takeover and reply", async ({ page }) => {
  const { email, password } = supportCredentials();
  const replyText = `Lifecycle smoke reply ${Date.now()}`;

  await page.goto(supportConsoleUrl());
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Sign In")');

  await expect(page.locator("text=Sessions")).toBeVisible({ timeout: 30000 });

  const rows = page.locator('[data-testid="session-row"]');
  const rowCount = await rows.count();
  test.skip(rowCount === 0, "No support sessions are visible in the configured environment.");

  await rows.first().click();
  await expect(page.locator("text=Conversation").or(page.locator("#reply-input"))).toBeVisible({ timeout: 15000 });

  const acceptButton = page.locator("#takeover-button");
  if ((await acceptButton.isVisible()) && (await acceptButton.isEnabled())) {
    await acceptButton.click();
  }

  const replyInput = page.locator("#reply-input");
  if (await replyInput.isEnabled()) {
    await replyInput.fill(replyText);
    await page.click('button:has-text("Send Reply")');
    await expect(page.locator(`text=${replyText}`)).toBeVisible({ timeout: 15000 });
  }
});

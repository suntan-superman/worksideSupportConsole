import { test, expect } from '@playwright/test';
import { hasSupportCredentials, supportCredentials, supportConsoleUrl } from './supportCredentials.js';

test.skip(!hasSupportCredentials(), 'Set PLAYWRIGHT_SUPPORT_TEST_EMAIL and PLAYWRIGHT_SUPPORT_TEST_PASSWORD to run live support tests.');

test('Agent can accept transfer and reply', async ({ page }) => {
  const { email, password } = supportCredentials();
  const replyText = `Test reply from Playwright ${Date.now()}`;

  await page.goto(supportConsoleUrl());

  // Login
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Sign In")');

  // Wait for sessions
  await expect(page.locator('text=Sessions')).toBeVisible();

  // Find a live session that can actually be accepted. Production data may include
  // sessions where the Accept Transfer button is visible but disabled.
  const sessions = page.locator('[data-testid="session-row"]');
  const sessionCount = await sessions.count();
  let foundActionableTransfer = false;

  for (let index = 0; index < sessionCount; index += 1) {
    await sessions.nth(index).click();
    const acceptButton = page.locator('#takeover-button');
    if ((await acceptButton.isVisible()) && (await acceptButton.isEnabled())) {
      foundActionableTransfer = true;
      await acceptButton.click();
      break;
    }
  }

  test.skip(!foundActionableTransfer, 'No currently visible live session has an enabled Accept Transfer action.');

  // Type reply
  const messageBox = page.locator('#reply-input');
  await expect(messageBox).toBeEnabled({ timeout: 15000 });
  await messageBox.fill(replyText);

  await page.click('button:has-text("Send Reply")');

  // Verify message appears
  await expect(page.locator(`text=${replyText}`)).toBeVisible();
});

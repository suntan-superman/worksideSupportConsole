import { test, expect } from '@playwright/test';
import { hasSupportCredentials, supportCredentials } from './supportCredentials.js';

test.skip(!hasSupportCredentials(), 'Set PLAYWRIGHT_SUPPORT_TEST_EMAIL and PLAYWRIGHT_SUPPORT_TEST_PASSWORD to run live support tests.');

test('Agent can accept transfer and reply', async ({ page }) => {
  const { email, password } = supportCredentials();

  await page.goto('https://support.worksidesoftware.com');

  // Login
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Sign In")');

  // Wait for sessions
  await expect(page.locator('text=Sessions')).toBeVisible();

  // Click first session
  const firstSession = page.locator('[data-testid="session-row"]').first();
  await firstSession.click();

  // Accept transfer if needed
  const acceptButton = page.locator('button:has-text("Accept")');
  if (await acceptButton.isVisible()) {
    await acceptButton.click();
  }

  // Type reply
  const messageBox = page.locator('textarea');
  await messageBox.fill('Test reply from Playwright');

  await page.click('button:has-text("Send")');

  // Verify message appears
  await expect(page.locator('text=Test reply from Playwright')).toBeVisible();
});

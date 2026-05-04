import { test, expect } from '@playwright/test';
import { hasSupportCredentials, supportCredentials } from './supportCredentials.js';

test.skip(!hasSupportCredentials(), 'Set PLAYWRIGHT_SUPPORT_TEST_EMAIL and PLAYWRIGHT_SUPPORT_TEST_PASSWORD to run live support tests.');

test('Support Console loads sessions after login', async ({ page }) => {
  const { email, password } = supportCredentials();

  await page.goto('https://support.worksidesoftware.com');

  // Fill login form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  await page.click('button:has-text("Sign In")');

  // Wait for sessions list to appear
  await expect(page.locator('text=Sessions')).toBeVisible({ timeout: 15000 });

  // Verify at least one session row loads
  const sessionRows = page.locator('[data-testid="session-row"]');
  await expect(sessionRows.first()).toBeVisible();
});

import { test, expect } from '@playwright/test';

test('Visitor can request human from public chat', async ({ page }) => {
  await page.goto('https://worksidesoftware.com');

  // Open chat widget
  const chatButton = page.locator('[data-testid="chat-open-button"]');
  await chatButton.click();

  // Send initial message
  const chatInput = page.locator('textarea');
  await chatInput.fill('I want to speak to someone');
  await page.keyboard.press('Enter');

  // Expect prompt for name/email
  await expect(page.locator('text=Before we connect you')).toBeVisible();

  // Fill contact info
  await page.fill('input[name="name"]', 'Test User');
  await page.fill('input[name="email"]', 'test@example.com');

  // Request human
  await page.click('button:has-text("Talk to a person")');

  // Confirm message
  await expect(page.locator('text=notifying our team')).toBeVisible();
});
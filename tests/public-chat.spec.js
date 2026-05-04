import { test, expect } from '@playwright/test';
import {
  openPublicChat,
  publicChatInput,
  publicHumanRequestStatus,
  publicLeadEmailInput,
  publicLeadNameInput,
  talkToPersonButton,
} from './publicChatHelpers.js';

test('Visitor can request human from public chat', async ({ page }) => {
  await page.goto('/');

  // Open chat widget
  const opened = await openPublicChat(page);
  test.skip(!opened, 'Public chat launcher was not visible on this deployment.');

  // Fill contact info and initial message.
  await publicLeadNameInput(page).fill('Test User');
  await publicLeadEmailInput(page).fill('test@example.com');

  const chatInput = publicChatInput(page);
  await expect(chatInput).toBeVisible({ timeout: 15000 });
  await chatInput.fill('I want to speak to someone');

  // Request human
  const talkToPerson = talkToPersonButton(page);
  await expect(talkToPerson).toBeEnabled({ timeout: 15000 });
  await talkToPerson.click();

  // Confirm message
  await expect(publicHumanRequestStatus(page)).toBeVisible({ timeout: 15000 });
});

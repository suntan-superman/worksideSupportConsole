import { expect, test } from "@playwright/test";
import {
  hasSupportCredentials,
  hasUnauthorizedCredentials,
  publicSiteUrl,
  supportCredentials,
  supportConsoleUrl,
  unauthorizedCredentials,
} from "./supportCredentials.js";
import {
  openPublicChat,
  publicChatInput,
  publicHumanRequestStatus,
  publicLeadEmailInput,
  publicLeadNameInput,
  talkToPersonButton,
} from "./publicChatHelpers.js";

async function login(page, credentials = supportCredentials()) {
  await page.goto(supportConsoleUrl());
  await page.fill('input[type="email"]', credentials.email);
  await page.fill('input[type="password"]', credentials.password);
  await page.click('button:has-text("Sign In")');
}

async function loginAsSupportUser(page) {
  test.skip(!hasSupportCredentials(), "Set support credentials to run live failure tests.");
  await login(page);
  await expect(page.locator("text=Sessions")).toBeVisible({ timeout: 15000 });
}

async function openFirstSession(page) {
  const firstSession = page.locator('[data-testid="session-row"]').first();
  await expect(firstSession).toBeVisible({ timeout: 15000 });
  await firstSession.click();
}

test("Cannot reply before accepting transfer", async ({ page }) => {
  await loginAsSupportUser(page);
  await openFirstSession(page);

  const messageBox = page.locator("textarea").last();
  await messageBox.fill("This should not send");
  await page.click('button:has-text("Send")');

  await expect(page.locator("text=Accept transfer before replying")).toBeVisible();
});

test("Cannot close session without lead", async ({ page }) => {
  await loginAsSupportUser(page);
  await openFirstSession(page);

  await page.click('button:has-text("Close")');

  await expect(page.locator("text=Capture lead")).toBeVisible();
});

test("Cannot transfer without inquiry when required", async ({ page }) => {
  await loginAsSupportUser(page);
  await openFirstSession(page);

  await page.click('button:has-text("Request Transfer")');

  await expect(page.locator("text=Capture inquiry")).toBeVisible();
});

test("Unauthorized user is blocked from support console", async ({ page }) => {
  test.skip(!hasUnauthorizedCredentials(), "Set unauthorized-user credentials to run this live negative auth test.");
  await login(page, unauthorizedCredentials());

  await expect(page.locator("text=not authorized")).toBeVisible({ timeout: 15000 });
});

test("Visitor sees no-agent-available message", async ({ page }) => {
  await page.goto(publicSiteUrl());
  const opened = await openPublicChat(page);
  test.skip(!opened, "Public chat launcher was not visible on this deployment.");

  const chatInput = publicChatInput(page);
  await expect(chatInput).toBeVisible({ timeout: 15000 });
  await publicLeadNameInput(page).fill("Test User");
  await publicLeadEmailInput(page).fill("test@example.com");
  await chatInput.fill("I need help");

  const talkToPerson = talkToPersonButton(page);
  await expect(talkToPerson).toBeEnabled({ timeout: 15000 });
  await talkToPerson.click();

  await expect(publicHumanRequestStatus(page)).toBeVisible({ timeout: 15000 });
});

test("Switching sessions does not corrupt state", async ({ page }) => {
  await loginAsSupportUser(page);

  const sessions = page.locator('[data-testid="session-row"]');
  const count = await sessions.count();
  test.skip(count < 2, "At least two live sessions are required.");

  await sessions.nth(0).click();
  await page.waitForTimeout(500);
  await sessions.nth(1).click();
  await page.waitForTimeout(500);

  await expect(page.locator("textarea").last()).toBeVisible();
});

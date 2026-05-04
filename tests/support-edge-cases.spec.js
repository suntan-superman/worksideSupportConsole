import { expect, test } from "@playwright/test";
import {
  hasSecondAgentCredentials,
  hasSupportCredentials,
  publicSiteUrl,
  runLongLiveTests,
  secondAgentCredentials,
  supportCredentials,
  supportConsoleUrl,
} from "./supportCredentials.js";
import {
  openPublicChat,
  publicChatInput,
  publicLeadNameInput,
  talkToPersonButton,
} from "./publicChatHelpers.js";

async function login(page, credentials = supportCredentials()) {
  await page.goto(supportConsoleUrl());
  await page.fill('input[type="email"]', credentials.email);
  await page.fill('input[type="password"]', credentials.password);
  await page.click('button:has-text("Sign In")');
  await expect(page.locator("text=Sessions")).toBeVisible({ timeout: 15000 });
}

async function loginAsSupportUser(page) {
  test.skip(!hasSupportCredentials(), "Set support credentials to run live edge-case tests.");
  await login(page);
}

async function openFirstSession(page) {
  const firstSession = page.locator('[data-testid="session-row"]').first();
  await expect(firstSession).toBeVisible({ timeout: 15000 });
  await firstSession.click();
}

test("Double-click takeover does not break session", async ({ page }) => {
  await loginAsSupportUser(page);
  await openFirstSession(page);

  const acceptBtn = page.locator('button:has-text("Accept")');
  if (await acceptBtn.isVisible()) {
    await acceptBtn.dblclick();
  }

  await expect(page.locator("textarea").last()).toBeVisible();
});

test("Reply is not lost during polling refresh", async ({ page }) => {
  await loginAsSupportUser(page);
  await openFirstSession(page);

  const messageBox = page.locator("textarea").last();
  await messageBox.fill("Typing during polling...");
  await page.waitForTimeout(6000);
  await page.click('button:has-text("Send")');

  await expect(page.locator("text=Typing during polling...")).toBeVisible();
});

test("Session removal does not crash UI", async ({ page }) => {
  await loginAsSupportUser(page);

  const sessions = page.locator('[data-testid="session-row"]');
  test.skip((await sessions.count()) === 0, "At least one live session is required.");

  await sessions.first().click();
  await page.waitForTimeout(8000);

  await expect(page.locator("textarea").last()).toBeVisible();
});

test("Second agent cannot override active session improperly", async ({ browser }) => {
  test.skip(
    !hasSupportCredentials() || !hasSecondAgentCredentials(),
    "Set primary and second-agent credentials to run this live concurrency test.",
  );

  const context1 = await browser.newContext();
  const context2 = await browser.newContext();

  try {
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await login(page1, supportCredentials());
    await openFirstSession(page1);

    const acceptBtn1 = page1.locator('button:has-text("Accept")');
    if (await acceptBtn1.isVisible()) {
      await acceptBtn1.click();
    }

    await login(page2, secondAgentCredentials());
    await openFirstSession(page2);

    const acceptBtn2 = page2.locator('button:has-text("Accept")');
    if (await acceptBtn2.isVisible()) {
      await acceptBtn2.click();
      await expect(page2.locator("text=already assigned")).toBeVisible();
    }
  } finally {
    await context1.close();
    await context2.close();
  }
});

test("Switching sessions rapidly does not corrupt UI", async ({ page }) => {
  await loginAsSupportUser(page);

  const sessions = page.locator('[data-testid="session-row"]');
  const count = await sessions.count();
  test.skip(count < 2, "At least two live sessions are required.");

  for (let i = 0; i < 5; i += 1) {
    await sessions.nth(0).click();
    await page.waitForTimeout(200);
    await sessions.nth(1).click();
    await page.waitForTimeout(200);
  }

  await expect(page.locator("textarea").last()).toBeVisible();
});

test("Public chat idle warning appears", async ({ page }) => {
  test.skip(!runLongLiveTests(), "Set PLAYWRIGHT_RUN_LONG_TESTS=true to run long idle-timeout tests.");
  test.setTimeout(330000);

  await page.goto(publicSiteUrl());
  const opened = await openPublicChat(page);
  test.skip(!opened, "Public chat launcher was not visible on this deployment.");
  await page.waitForTimeout(310000);

  await expect(page.locator("text=Are you still there")).toBeVisible();
});

test("Partial lead entry does not break session", async ({ page }) => {
  await page.goto(publicSiteUrl());
  const opened = await openPublicChat(page);
  test.skip(!opened, "Public chat launcher was not visible on this deployment.");

  const chatInput = publicChatInput(page);
  await expect(chatInput).toBeVisible({ timeout: 15000 });
  await chatInput.fill("Need help");
  await page.keyboard.press("Enter");

  await publicLeadNameInput(page).fill("Test User");

  const talkToPerson = talkToPersonButton(page);
  await expect(talkToPerson).toBeDisabled();

  await expect(page.locator("text=email")).toBeVisible();
});

test("UI remains stable during delayed response", async ({ page }) => {
  await loginAsSupportUser(page);
  await openFirstSession(page);

  await page.route("**/support/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });

  await page.click('button:has-text("Refresh")');

  await expect(page.locator("text=Sessions")).toBeVisible();
});

import { expect, test } from "@playwright/test";
import { supportConsoleUrl, unauthorizedCredentials } from "../supportCredentials.js";

test.skip(
  !unauthorizedCredentials().email ||
    !unauthorizedCredentials().password ||
    process.env.PLAYWRIGHT_RUN_SUPPORT_FAILURES !== "true",
  "Set unauthorized credentials and PLAYWRIGHT_RUN_SUPPORT_FAILURES=true to run failure-path tests.",
);

test("unauthorized Firebase user is blocked from support console", async ({ page }) => {
  const { email, password } = unauthorizedCredentials();

  await page.goto(supportConsoleUrl());
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Sign In")');

  await expect(
    page
      .locator("text=not authorized")
      .or(page.locator("text=not set up"))
      .or(page.locator("text=access")),
  ).toBeVisible({ timeout: 30000 });
});

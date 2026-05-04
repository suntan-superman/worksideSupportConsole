export function hasSupportCredentials() {
  return Boolean(process.env.PLAYWRIGHT_SUPPORT_TEST_EMAIL && process.env.PLAYWRIGHT_SUPPORT_TEST_PASSWORD);
}

export function supportCredentials() {
  return {
    email: process.env.PLAYWRIGHT_SUPPORT_TEST_EMAIL ?? "",
    password: process.env.PLAYWRIGHT_SUPPORT_TEST_PASSWORD ?? "",
  };
}

export function supportConsoleUrl() {
  return process.env.PLAYWRIGHT_SUPPORT_CONSOLE_URL || "https://support.worksidesoftware.com";
}

export function publicSiteUrl() {
  return process.env.PLAYWRIGHT_PUBLIC_SITE_URL || "https://worksidesoftware.com";
}

export function hasUnauthorizedCredentials() {
  return Boolean(
    process.env.PLAYWRIGHT_UNAUTHORIZED_TEST_EMAIL && process.env.PLAYWRIGHT_UNAUTHORIZED_TEST_PASSWORD,
  );
}

export function unauthorizedCredentials() {
  return {
    email: process.env.PLAYWRIGHT_UNAUTHORIZED_TEST_EMAIL ?? "",
    password: process.env.PLAYWRIGHT_UNAUTHORIZED_TEST_PASSWORD ?? "",
  };
}

export function hasSecondAgentCredentials() {
  return Boolean(
    process.env.PLAYWRIGHT_SECOND_AGENT_TEST_EMAIL && process.env.PLAYWRIGHT_SECOND_AGENT_TEST_PASSWORD,
  );
}

export function secondAgentCredentials() {
  return {
    email: process.env.PLAYWRIGHT_SECOND_AGENT_TEST_EMAIL ?? "",
    password: process.env.PLAYWRIGHT_SECOND_AGENT_TEST_PASSWORD ?? "",
  };
}

export function runLongLiveTests() {
  return process.env.PLAYWRIGHT_RUN_LONG_TESTS === "true";
}

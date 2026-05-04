export function hasSupportCredentials() {
  return Boolean(process.env.PLAYWRIGHT_SUPPORT_TEST_EMAIL && process.env.PLAYWRIGHT_SUPPORT_TEST_PASSWORD);
}

export function supportCredentials() {
  return {
    email: process.env.PLAYWRIGHT_SUPPORT_TEST_EMAIL ?? "",
    password: process.env.PLAYWRIGHT_SUPPORT_TEST_PASSWORD ?? "",
  };
}

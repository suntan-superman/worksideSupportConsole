import { fileURLToPath } from "node:url";

export default {
  productName: "Workside Support Console",
  productSlug: "support-console",
  reportProductKey: "SupportConsole",
  appRoot: fileURLToPath(new URL(".", import.meta.url)),
  baseUrl: process.env.SUPPORT_CONSOLE_RELEASE_BASE_URL || "https://support.worksidesoftware.com",
  localUrl: "http://127.0.0.1:3000",
  environment: process.env.RELEASE_TEST_TARGET || "production",
  app: {
    type: "web",
    framework: "react-vite"
  },
  checks: {
    env: { enabled: true, blocking: true },
    browser: { enabled: true, blocking: true },
    routes: { enabled: true, blocking: true },
    auth: { enabled: true, blocking: false },
    stripe: { enabled: false, blocking: false },
    meta: { enabled: false, blocking: false },
    seo: { enabled: false, blocking: false },
    lighthouse: { enabled: false, blocking: false },
    links: { enabled: false, blocking: false }
  },
  requiredEnv: [],
  routes: ["/", "/login"],
  meta: {
    enabled: false
  },
  auth: {
    enabled: true,
    testEmail: process.env.RELEASE_TEST_EMAIL,
    testPassword: process.env.RELEASE_TEST_PASSWORD,
    loginUrl: "/login",
    dashboardUrl: "/",
    credentials: {
      emailEnv: "RELEASE_TEST_EMAIL",
      passwordEnv: "RELEASE_TEST_PASSWORD"
    },
    selectors: {}
  },
  stripe: {
    enabled: false,
    testModeOnly: true,
    allowRealCharges: false
  },
  seo: {
    enabled: false
  },
  reporting: {
    outputDir: "./reports/SupportConsole",
    formats: ["json", "html", "md", "certification"],
    archive: true
  }
};

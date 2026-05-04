import { defineConfig } from "@playwright/test";
import { loadEnv } from "vite";

Object.assign(process.env, loadEnv("", process.cwd(), ""));

export default defineConfig({
  testDir: "./tests",
  testMatch: ["support-failures.spec.js", "support-edge-cases.spec.js"],
  use: {
    baseURL: process.env.PLAYWRIGHT_SUPPORT_CONSOLE_URL || "https://support.worksidesoftware.com",
  },
});

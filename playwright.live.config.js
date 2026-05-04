import { defineConfig } from "@playwright/test";
import { loadEnv } from "vite";

Object.assign(process.env, loadEnv("", process.cwd(), ""));

export default defineConfig({
  testDir: "./tests",
  testMatch: ["support-login.spec.js", "support-flow.spec.js"],
  use: {
    baseURL: "https://support.worksidesoftware.com",
  },
});

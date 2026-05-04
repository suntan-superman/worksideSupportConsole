import { defineConfig } from "@playwright/test";
import { loadEnv } from "vite";

Object.assign(process.env, loadEnv("", process.cwd(), ""));

export default defineConfig({
  testDir: "./tests",
  testMatch: ["public-chat.spec.js"],
  use: {
    baseURL: process.env.PLAYWRIGHT_PUBLIC_SITE_URL || "https://worksidesoftware.com",
  },
});

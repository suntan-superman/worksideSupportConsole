const fs = require("fs");
const path = require("path");

const base = require("./app.json");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(__dirname, "..", ".env.local"));
loadEnvFile(path.resolve(__dirname, "..", ".env"));
loadEnvFile(path.resolve(__dirname, ".env.local"));
loadEnvFile(path.resolve(__dirname, ".env"));

function envValue(expoKey, viteKey, fallback = "") {
  return process.env[expoKey] || process.env[viteKey] || fallback;
}

const apiBaseUrl = envValue("EXPO_PUBLIC_API_BASE_URL", "VITE_API_BASE_URL", "https://api.merxus.ai");
const firebaseConfig = {
  apiKey: envValue("EXPO_PUBLIC_FIREBASE_API_KEY", "VITE_FIREBASE_API_KEY"),
  authDomain: envValue("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: envValue("EXPO_PUBLIC_FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID"),
  appId: envValue("EXPO_PUBLIC_FIREBASE_APP_ID", "VITE_FIREBASE_APP_ID")
};

module.exports = {
  ...base.expo,
  extra: {
    ...(base.expo.extra || {}),
    apiBaseUrl,
    firebaseConfig
  }
};

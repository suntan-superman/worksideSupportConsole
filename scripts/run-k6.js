import { spawn } from "node:child_process";
import { loadEnv } from "vite";

const [, , scriptPath, ...args] = process.argv;

if (!scriptPath) {
  console.error("Usage: node scripts/run-k6.js <k6-script> [k6 args...]");
  process.exit(1);
}

const env = {
  ...process.env,
  ...loadEnv("", process.cwd(), ""),
};

const child = spawn("k6", ["run", scriptPath, ...args], {
  env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`k6 exited from signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

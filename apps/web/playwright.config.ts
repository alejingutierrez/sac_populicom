import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "pnpm --filter @sac/web start --hostname 127.0.0.1 --port 3000",
    cwd: path.resolve(__dirname, "../.."),
    url: "http://127.0.0.1:3000",
    timeout: 120_000,
    reuseExistingServer: true
  }
});

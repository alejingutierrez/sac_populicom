import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node"
  },
  resolve: {
    alias: {
      "@sac/auth": path.resolve(__dirname, "packages/auth/src/index.ts"),
      "@sac/brandwatch": path.resolve(__dirname, "packages/brandwatch/src/index.ts"),
      "@sac/config": path.resolve(__dirname, "packages/config/src/index.ts"),
      "@sac/db": path.resolve(__dirname, "packages/db/src/index.ts"),
      "@sac/service-exports": path.resolve(__dirname, "services/exports/src/index.ts"),
      "@sac/service-ingestion": path.resolve(__dirname, "services/ingestion/src/index.ts"),
      "@sac/service-notifications": path.resolve(__dirname, "services/notifications/src/index.ts"),
      "@sac/ui": path.resolve(__dirname, "packages/ui/src/index.tsx")
    }
  }
});

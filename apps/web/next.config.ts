import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@sac/auth",
    "@sac/config",
    "@sac/db",
    "@sac/service-exports",
    "@sac/ui"
  ]
};

export default nextConfig;

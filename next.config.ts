import type { NextConfig } from "next";

const DEFAULT_DEVELOPMENT_API_URL = "https://dev-api.bbangbat.com";
const apiBaseUrl = (
  process.env.API_BASE_URL
  || process.env.NEXT_PUBLIC_API_BASE_URL
  || DEFAULT_DEVELOPMENT_API_URL
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${apiBaseUrl}/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;

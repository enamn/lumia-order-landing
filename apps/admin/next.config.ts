import type { NextConfig } from "next";
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];
const config: NextConfig = { poweredByHeader: false, turbopack: { root: process.cwd() }, experimental: { cpus: 2 }, async headers() { return [{ source: "/:path*", headers: securityHeaders }]; } };
export default config;
